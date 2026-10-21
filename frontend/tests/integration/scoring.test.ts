import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, expect, test, vi } from "vitest";
import { scoreListing, selectTopListings } from "@/features/discovery/steps/score-listings";
import { getAdminClient } from "@/server/supabase/admin";

// The scoring steps against the real database and the owner's real profile, with a fake model.
// Queued steps are collected here instead of going to the real queue.
const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({ createStructuredModel: () => ({ invoke: invokeModel }) }));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
  wakeWorker: async () => {},
}));

function modelAnswer(parsed: unknown) {
  const raw = new AIMessage({
    content: JSON.stringify(parsed),
    usage_metadata: { input_tokens: 3_000, output_tokens: 150, total_tokens: 3_150 },
  });
  return { raw, parsed };
}

function rating(score: number, offersVisaSponsorship = false) {
  return { technical: score, experience: score, careerAlignment: score, strengths: ["React"], gaps: [], offersVisaSponsorship };
}

const database = getAdminClient();
const runId = randomUUID();

afterAll(async () => {
  await database.from("model_calls").delete().eq("run_id", runId);
  await database.from("listings").delete().eq("run_id", runId);
  await database.from("runs").delete().eq("id", runId);
});

async function addListing(name: string, eligibility: string): Promise<string> {
  const { data, error } = await database
    .from("listings")
    .insert({
      source: "test",
      source_id: `${name}-${runId}`,
      url: "https://example.com/job",
      title: `${name} engineer`,
      company: `Scoring Test ${runId}`,
      description: "Build web apps with React and Node.",
      eligibility,
      fingerprint: `${name}-${runId}`,
      tags: ["remote"],
      run_id: runId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

test("scores each listing once, then keeps the best ones, eligible before unclear, and finishes the run", async () => {
  const run = await database.from("runs").insert({ id: runId, kind: "daily" });
  if (run.error) throw run.error;
  const strong = await addListing("strong", "eligible");
  const weak = await addListing("weak", "eligible");
  const unclear = await addListing("unclear", "unclear");

  invokeModel.mockResolvedValueOnce(modelAnswer(rating(80, true)));
  await scoreListing({ listingId: strong });
  await scoreListing({ listingId: strong });
  invokeModel.mockResolvedValueOnce(modelAnswer(rating(30)));
  await scoreListing({ listingId: weak });
  expect(queued).toEqual([]);

  // The last listing scored hands the run on to choosing the top listings.
  invokeModel.mockResolvedValueOnce(modelAnswer(rating(95)));
  await scoreListing({ listingId: unclear });
  expect(invokeModel).toHaveBeenCalledTimes(3);
  expect(queued).toEqual([{ step: "select_top_listings", payload: { runId } }]);

  const { data: strongListing } = await database.from("listings").select("tags, scores (score, reasons)").eq("id", strong).single();
  expect(strongListing).toEqual({ tags: ["remote", "visa"], scores: { score: 80, reasons: "Strengths:\n- React" } });

  queued.length = 0;
  await selectTopListings({ runId });
  await selectTopListings({ runId });

  const { data: ranks } = await database.from("listings").select("id, top_rank").eq("run_id", runId);
  expect(Object.fromEntries((ranks ?? []).map(({ id, top_rank }) => [id, top_rank]))).toEqual({
    [strong]: 1,
    [unclear]: 2,
    [weak]: null,
  });
  // Each kept listing goes on to its note; running the step twice queues them twice, and the note step
  // makes one application per listing.
  const noteStep = (listingId: string) => ({ step: "prepare_note_application", payload: { listingId } });
  expect(queued).toEqual([noteStep(strong), noteStep(unclear), noteStep(strong), noteStep(unclear)]);
  const { data: finished } = await database.from("runs").select("status, listings_scored").eq("id", runId).single();
  expect(finished).toEqual({ status: "succeeded", listings_scored: 3 });

  // Every model call is costed against the run (B1).
  const { count } = await database.from("model_calls").select("id", { count: "exact", head: true }).eq("run_id", runId);
  expect(count).toBe(3);
});
