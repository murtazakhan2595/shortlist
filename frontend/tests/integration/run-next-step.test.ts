import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { enqueueStep, queueLength } from "@/server/queue/queue";
import { MAX_ATTEMPTS, runNextStep } from "@/server/queue/run-next-step";
import { getAdminClient } from "@/server/supabase/admin";

// The step runner against the real database, on the steps_test queue only, so real work is never touched.
const queue = "steps_test" as const;
const noWait = { queue, retryDelaySecondsPerAttempt: 0 };

async function addTestStep(step: string, payload = { n: 1 }) {
  return enqueueStep(step, payload, { queue, wake: false });
}

describe("runNextStep", () => {
  beforeEach(async () => {
    expect(await queueLength(queue), "the steps_test queue should start empty").toBe(0);
  });

  afterAll(async () => {
    await getAdminClient().from("failed_steps").delete().eq("queue", queue);
  });

  test("reports an empty queue", async () => {
    expect(await runNextStep({}, noWait)).toEqual({ stepsRun: 0, stepsFailed: 0, queueEmpty: true });
  });

  test("runs a step with its payload and removes it from the queue", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await addTestStep("test_step", { n: 7 });

    const summary = await runNextStep({ test_step: handler }, noWait);

    expect(summary).toEqual({ stepsRun: 1, stepsFailed: 0, queueEmpty: false });
    expect(handler).toHaveBeenCalledWith({ n: 7 });
    expect(await queueLength(queue)).toBe(0);
  });

  test("retries a step that fails, and completes it once it succeeds", async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error("provider busy")).mockResolvedValueOnce(undefined);
    await addTestStep("test_step");

    expect((await runNextStep({ test_step: handler }, noWait)).stepsFailed).toBe(1);
    expect(await queueLength(queue)).toBe(1);

    expect((await runNextStep({ test_step: handler }, noWait)).stepsFailed).toBe(0);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await queueLength(queue)).toBe(0);
  });

  test(`records a step that fails ${MAX_ATTEMPTS} times, with its last error`, async () => {
    const handler = vi.fn().mockRejectedValue(new Error("still broken"));
    const messageId = await addTestStep("test_step");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) await runNextStep({ test_step: handler }, noWait);

    expect(handler).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(await queueLength(queue)).toBe(0);
    const { data } = await getAdminClient().from("failed_steps").select("*").eq("message_id", messageId).single();
    expect(data).toMatchObject({ queue, step: "test_step", attempts: MAX_ATTEMPTS, error: "Error: still broken" });
  });

  test("records a step with no handler at once, without retrying", async () => {
    const messageId = await addTestStep("unknown_step");

    await runNextStep({}, noWait);

    expect(await queueLength(queue)).toBe(0);
    const { data } = await getAdminClient().from("failed_steps").select("attempts, error").eq("message_id", messageId).single();
    expect(data).toEqual({ attempts: 1, error: 'Error: No handler for step "unknown_step"' });
  });
});
