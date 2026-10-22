import "server-only";
import { describeError } from "@/lib/errors";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import type { QueueName } from "./queue";
import type { WorkerRunSummary } from "./schemas";

// Runs one queued step (PLAN.md items 1.8 and 5.6; AGENTS.md, Architecture rule 7).
// A step that throws is retried later; after MAX_ATTEMPTS it is recorded in failed_steps, where the owner
// sees it and can try it again (failed-steps.ts).

export type StepHandler = {
  /** Runs the step. Must be safe to run twice, because a step can be retried after doing part of its work. */
  run: (payload: Json) => Promise<void>;
  /**
   * Runs once the step has failed every attempt, for work that must not wait on it: for example, the
   * daily run still ranks its other listings when one cannot be scored. Must also be safe to run twice.
   */
  giveUp?: (payload: Json) => Promise<void>;
};

export type StepHandlers = Record<string, StepHandler>;

export const MAX_ATTEMPTS = 3;

// Longer than the 60-second step budget: a step is retried only if its worker died or overran.
const VISIBILITY_SECONDS = 90;

// The wait before a retry grows with each attempt: 30 s, then 60 s.
const RETRY_DELAY_SECONDS_PER_ATTEMPT = 30;

export type RunOptions = {
  queue?: QueueName;
  /** Tests set this to 0 so retries can be checked without waiting. */
  retryDelaySecondsPerAttempt?: number;
};

type QueuedStep = { message_id: number; attempts: number; step: string; payload: Json };

export async function runNextStep(handlers: StepHandlers, options: RunOptions = {}): Promise<WorkerRunSummary> {
  const queue = options.queue ?? "steps";
  const step = await readNextStep(queue);
  if (!step) return { stepsRun: 0, stepsFailed: 0, queueEmpty: true };

  const handler = handlers[step.step];
  try {
    if (!handler) throw new Error(`No handler for step "${step.step}"`);
    await handler.run(step.payload);
  } catch (error) {
    // An unknown step will never succeed, so it is not retried.
    const isLastAttempt = !handler || step.attempts >= MAX_ATTEMPTS;
    if (isLastAttempt) {
      await failStep(queue, step, describeError(error));
      await handler?.giveUp?.(step.payload);
    } else {
      const delayPerAttempt = options.retryDelaySecondsPerAttempt ?? RETRY_DELAY_SECONDS_PER_ATTEMPT;
      await retryStepLater(queue, step, delayPerAttempt * step.attempts);
    }
    return { stepsRun: 1, stepsFailed: 1, queueEmpty: false };
  }

  await completeStep(queue, step);
  return { stepsRun: 1, stepsFailed: 0, queueEmpty: false };
}

async function readNextStep(queue: QueueName): Promise<QueuedStep | undefined> {
  const { data, error } = await getAdminClient().rpc("read_next_step", {
    queue_name: queue,
    visibility_seconds: VISIBILITY_SECONDS,
  });
  if (error) throw new Error(`Could not read the ${queue} queue: ${error.message}`);
  return data[0];
}

async function completeStep(queue: QueueName, step: QueuedStep): Promise<void> {
  const { error } = await getAdminClient().rpc("complete_step", { queue_name: queue, message_id: step.message_id });
  if (error) throw new Error(`Could not complete step ${step.step}: ${error.message}`);
}

async function retryStepLater(queue: QueueName, step: QueuedStep, delaySeconds: number): Promise<void> {
  const { error } = await getAdminClient().rpc("retry_step_later", {
    queue_name: queue,
    message_id: step.message_id,
    delay_seconds: delaySeconds,
  });
  if (error) throw new Error(`Could not schedule a retry of step ${step.step}: ${error.message}`);
}

async function failStep(queue: QueueName, step: QueuedStep, error: string): Promise<void> {
  const { error: rpcError } = await getAdminClient().rpc("fail_step", {
    queue_name: queue,
    message_id: step.message_id,
    step: step.step,
    payload: step.payload,
    attempts: step.attempts,
    error,
  });
  if (rpcError) throw new Error(`Could not record the failure of step ${step.step}: ${rpcError.message}`);
}
