import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, expect, test, vi } from "vitest";
import { advanceWriter, prepareNoteApplication } from "@/features/applications/steps/writer-steps";
import { getCheckpointer } from "@/server/queue/checkpointer";
import { getAdminClient } from "@/server/supabase/admin";

// A listing's note (X2) through the writer's queued steps, against the real database, its LangGraph
// checkpoints and the owner's real material, with a fake model. Queued steps are collected here and run
// one by one, as the worker would.
const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({ createStructuredModel: () => ({ invoke: invokeModel }) }));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
}));

// The monthly cap is not reached here; spending-cap.test.ts covers the cap.
vi.mock("@/server/spending", () => ({ loadSpendingCap: async () => ({ spentUsd: 0, capUsd: 50, reached: false }) }));

function modelAnswer(parsed: unknown) {
  const raw = new AIMessage({
    content: JSON.stringify(parsed),
    usage_metadata: { input_tokens: 20_000, output_tokens: 300, total_tokens: 20_300 },
  });
  return { raw, parsed };
}

// Plain words only, within the job-board note's 50 to 100 words, so the code check passes on any profile.
const NOTE = {
  cvVariant: "full_stack",
  presentedTitle: "Software Engineer",
  emailPattern: "job-board-note",
  subject: "",
  body: [
    "I build web products from the database up to the screens people use, and I write the tests that keep them working.",
    "In my current work I plan features with the team, ship them in small steps, and stay with them after release until they work well for the people who use them every day.",
    "I work remotely, overlap with your hours and can start soon.",
  ].join(" "),
  signature: "",
};

const database = getAdminClient();
const runId = randomUUID();
const applicationIds: string[] = [];

afterAll(async () => {
  await database.from("model_calls").delete().eq("run_id", runId);
  await database.from("listings").delete().eq("run_id", runId);
  await database.from("runs").delete().eq("id", runId);
  for (const id of applicationIds) {
    await database.from("applications").delete().eq("id", id);
    await getCheckpointer().deleteThread(id);
  }
});

async function addListing(name: string, topRank: number | null): Promise<string> {
  const { data, error } = await database
    .from("listings")
    .insert({
      source: "test",
      source_id: `${name}-${runId}`,
      url: "https://example.com/job",
      title: "Software Engineer",
      company: `Notes Test ${name} ${runId}`,
      description: "We build web products. Apply through our site.",
      eligibility: "eligible",
      fingerprint: `${name}-${runId}`,
      run_id: runId,
      top_rank: topRank,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Runs queued steps in order, as the worker would, until none are left. */
async function runQueuedSteps(maxSteps = 12) {
  for (let count = 0; queued.length > 0 && count < maxSteps; count++) {
    const next = queued.shift();
    if (next?.step !== "advance_writer") throw new Error(`Unexpected step ${next?.step}`);
    await advanceWriter(next.payload as { applicationId: string });
  }
}

// Every stage saves a LangGraph checkpoint over the network, so the loop takes several seconds.
test("a top listing gets one application with a checked note and a CV, and no Gmail draft", { timeout: 60_000 }, async () => {
  const run = await database.from("runs").insert({ id: runId, kind: "daily" });
  if (run.error) throw run.error;
  const listingId = await addListing("top", 1);
  invokeModel.mockResolvedValueOnce(modelAnswer(NOTE)).mockResolvedValueOnce(modelAnswer({ problems: [] }));

  await prepareNoteApplication({ listingId });
  await prepareNoteApplication({ listingId });

  const { data: started } = await database.from("applications").select("id").eq("listing_id", listingId);
  expect(started).toHaveLength(1);
  const applicationId = started?.[0].id ?? "";
  applicationIds.push(applicationId);
  expect(queued).toEqual([
    { step: "advance_writer", payload: { applicationId } },
    { step: "advance_writer", payload: { applicationId } },
  ]);

  await runQueuedSteps();

  const { data: application } = await database
    .from("applications")
    .select("route, status, recipient_email, subject, body, cv_file_id, current_documents (name)")
    .eq("id", applicationId)
    .single();
  expect(application).toMatchObject({
    route: "note",
    status: "ready",
    recipient_email: null,
    subject: null,
    body: NOTE.body,
    current_documents: { name: "job-board-note" },
  });
  expect(application?.cv_file_id).not.toBeNull();
  // Both calls were the note steps, costed against the night's run (B1).
  const { data: calls } = await database.from("model_calls").select("step").eq("run_id", runId).order("created_at");
  expect(calls?.map((call) => call.step)).toEqual(["write_note", "check_note"]);
});

test("a listing outside the top N gets no application", async () => {
  const listingId = await addListing("not-kept", null);

  await prepareNoteApplication({ listingId });

  const { data } = await database.from("applications").select("id").eq("listing_id", listingId);
  expect(data).toEqual([]);
  expect(queued).toEqual([]);
});
