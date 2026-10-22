import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { findOpenFailures, retryFailedStep } from "@/server/queue/failed-steps";
import { getAdminClient } from "@/server/supabase/admin";

// Failed steps against the real database. Queueing is replaced, so no step really runs again.
const queued = vi.hoisted(() => ({ steps: [] as { step: string; payload: unknown }[], fail: false }));
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => {
    if (queued.fail) throw new Error("The queue is down");
    queued.steps.push({ step, payload });
    return queued.steps.length;
  },
}));

const database = getAdminClient();
// Ids no real capture, application or listing has, so these rows touch nothing else.
const captureId = randomUUID();
const applicationId = randomUUID();
const listingId = randomUUID();
const ids = [captureId, applicationId, listingId];

beforeEach(() => {
  queued.steps.length = 0;
  queued.fail = false;
});

afterAll(async () => {
  for (const id of ids) {
    for (const key of ["captureId", "applicationId", "listingId"]) {
      await database.from("failed_steps").delete().eq(`payload->>${key}`, id);
    }
  }
});

async function addFailure(step: string, payload: Record<string, string>, queue = "steps") {
  const { data, error } = await database
    .from("failed_steps")
    .insert({ queue, message_id: 0, step, payload, attempts: 3, error: `Error: ${step} broke` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

test("finds the open failures of what it is asked about, by any id in the payload", async () => {
  const readFailure = await addFailure("extract_capture", { captureId });
  const draftFailure = await addFailure("advance_writer", { applicationId });
  await addFailure("score_listing", { listingId }, "steps_test");

  const forCapture = await findOpenFailures(database, [captureId]);
  const forBoth = await findOpenFailures(database, [applicationId, captureId, "not-an-id"]);

  expect(forCapture).toEqual([
    { id: readFailure, step: "extract_capture", error: "Error: extract_capture broke", failedAt: expect.any(String), targetIds: [captureId] },
  ]);
  expect(forBoth.map((failure) => failure.id).sort()).toEqual([readFailure, draftFailure].sort());
  // A test queue's failures are never shown.
  expect(await findOpenFailures(database, [listingId])).toEqual([]);
});

test("trying again queues the step with its payload once, however often it is asked, and closes the failure", async () => {
  const failureId = await addFailure("prepare_note_application", { listingId });

  const results = await Promise.all([retryFailedStep(database, failureId), retryFailedStep(database, failureId)]);

  expect(results.sort()).toEqual([false, true]);
  expect(queued.steps).toEqual([{ step: "prepare_note_application", payload: { listingId } }]);
  expect((await findOpenFailures(database, [listingId])).map((failure) => failure.id)).not.toContain(failureId);
});

test("if the step cannot be queued, the failure stays open to try again", async () => {
  const failureId = await addFailure("create_gmail_draft", { applicationId });
  queued.fail = true;

  await expect(retryFailedStep(database, failureId)).rejects.toThrow("The queue is down");

  expect((await findOpenFailures(database, [applicationId])).map((failure) => failure.id)).toContain(failureId);
});
