import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, expect, test, vi } from "vitest";
import { scoreListing, skipFailedListing, selectTopListings } from "@/features/discovery/steps/score-listings";
import { getAdminClient } from "@/server/supabase/admin";
import { TEST_RUN_STARTED_AT } from "./test-runs";

const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({ createStructuredModel: () => ({ invoke: invokeModel }) }));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
  wakeWorker: async () => {},
}));

// The monthly cap is not reached here; spending-cap.test.ts covers the cap.
vi.mock("@/server/spending", () => ({ loadSpendingCap: async () => ({ spentUsd: 0, capUsd: 50, reached: false }) }));

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
const secondRunId = randomUUID();

afterAll(async () => {
  for (const id of [runId, secondRunId]) {
    await database.from("failed_steps").delete().eq("payload->>runId", id);
    await database.from("model_calls").delete().eq("run_id", id);
    await database.from("listings").delete().eq("run_id", id);
    await database.from("runs").delete().eq("id", id);
  }
});

async function addListing(name: string, eligibility: string, run = runId, contactEmail: string | null = null): Promise<string> {
  const { data, error } = await database
    .from("listings")
    .insert({
      source: "test",
      source_id: `${name}-${run}`,
      url: "https://example.com/job",
      title: `${name} engineer`,
      company: `Scoring Test ${run}`,
      description: "Build web apps with React and Node.",
      eligibility,
      fingerprint: `${name}-${run}`,
      tags: ["remote"],
      run_id: run,
      contact_email: contactEmail,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

test("scores each listing once, then keeps the best ones by score, writes emails only where the post gave an address, and finishes the run", async () => {
  const run = await database.from("runs").insert({ id: runId, kind: "daily", started_at: TEST_RUN_STARTED_AT });
  if (run.error) throw run.error;
  const strong = await addListing("strong", "eligible", runId, "jobs@acme.example");
  const weak = await addListing("weak", "eligible");
  const unclear = await addListing("unclear", "unclear");

  invokeModel.mockResolvedValueOnce(modelAnswer(rating(80, true)));
  await scoreListing({ listingId: strong });
  await scoreListing({ listingId: strong });
  invokeModel.mockResolvedValueOnce(modelAnswer(rating(30)));
  await scoreListing({ listingId: weak });
  expect(queued).toEqual([]);

  invokeModel.mockResolvedValueOnce(modelAnswer(rating(95)));
  await scoreListing({ listingId: unclear });
  expect(invokeModel).toHaveBeenCalledTimes(3);
  expect(queued).toEqual([{ step: "select_top_listings", payload: { runId } }]);

  const { data: strongListing } = await database.from("listings").select("tags, scores (score, reasons)").eq("id", strong).single();
  expect(strongListing).toEqual({ tags: ["remote", "visa"], scores: { score: 80, reasons: "Strengths:\n- React" } });

  // A rank left by an earlier pass is cleared, so it never mixes with this one.
  const stale = await database.from("listings").update({ top_rank: 3 }).eq("id", weak);
  if (stale.error) throw stale.error;
  queued.length = 0;
  await selectTopListings({ runId });
  await selectTopListings({ runId });

  const { data: ranks } = await database.from("listings").select("id, top_rank").eq("run_id", runId);
  // By score: an unclear listing is ranked like the rest, and the Jobs page shows what to check first.
  expect(Object.fromEntries((ranks ?? []).map(({ id, top_rank }) => [id, top_rank]))).toEqual({
    [unclear]: 1,
    [strong]: 2,
    [weak]: null,
  });
  // Only the kept listing whose post gave an address goes on to its email, once: the second pass finds the
  // run finished and does nothing.
  expect(queued).toEqual([{ step: "prepare_listing_application", payload: { listingId: strong } }]);
  const { data: finished } = await database.from("runs").select("status, listings_scored").eq("id", runId).single();
  expect(finished).toEqual({ status: "succeeded", listings_scored: 3 });

  const { count } = await database.from("model_calls").select("id", { count: "exact", head: true }).eq("run_id", runId);
  expect(count).toBe(3);
});

test("a listing that cannot be scored does not hold up the run, and one scored on a retry after the run just gets its score", async () => {
  const run = await database.from("runs").insert({ id: secondRunId, kind: "daily", started_at: TEST_RUN_STARTED_AT });
  if (run.error) throw run.error;
  const scored = await addListing("scored", "eligible", secondRunId);
  const broken = await addListing("broken", "eligible", secondRunId);
  queued.length = 0;

  invokeModel.mockResolvedValueOnce(modelAnswer(rating(80)));
  await scoreListing({ listingId: scored });
  expect(queued).toEqual([]);

  // The worker records the broken listing's last failure, then gives up on it. The row names the run so
  // this test can delete it; a real step's payload names only the listing.
  const failure = await database
    .from("failed_steps")
    .insert({ queue: "steps", message_id: 0, step: "score_listing", payload: { listingId: broken, runId: secondRunId }, attempts: 3, error: "test" })
    .select("id")
    .single();
  if (failure.error) throw failure.error;
  await skipFailedListing({ listingId: broken });
  expect(queued).toEqual([{ step: "select_top_listings", payload: { runId: secondRunId } }]);

  await selectTopListings({ runId: secondRunId });
  queued.length = 0;

  await database.from("failed_steps").delete().eq("id", failure.data.id);
  invokeModel.mockResolvedValueOnce(modelAnswer(rating(90)));
  await scoreListing({ listingId: broken });
  expect(queued).toEqual([]);
  const { data } = await database.from("listings").select("top_rank, scores (score)").eq("id", broken).single();
  expect(data).toEqual({ top_rank: null, scores: { score: 90 } });
});
