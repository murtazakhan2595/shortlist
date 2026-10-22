"use server";

import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import { retryFailedStep as queueFailedStepAgain } from "@/server/queue/failed-steps";
import { type RetryFailedStepInput, RetryFailedStepInputSchema } from "./schemas";

// Server Actions for failed steps (contracts in ./schemas.ts).

/** Queues a step that failed every attempt once more, with its payload, so it carries on where it stopped. */
export async function retryFailedStep(request: RetryFailedStepInput): Promise<Result<RetryFailedStepInput>> {
  const input = RetryFailedStepInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    const retried = await queueFailedStepAgain(db, input.data.failedStepId);
    if (!retried) return fail("conflict", "This was already tried again.");
    return ok(input.data);
  } catch (error) {
    return fail("internal", describeError(error));
  }
}
