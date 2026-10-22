"use server";

import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import { dismissFailedStep as closeFailedStep, retryFailedStep as queueFailedStepAgain } from "@/server/queue/failed-steps";
import { type FailedStepInput, FailedStepInputSchema } from "./schemas";

// Server Actions for failed steps (contracts in ./schemas.ts).

/** Queues a step that failed every attempt once more, with its payload, so it carries on where it stopped. */
export async function retryFailedStep(request: FailedStepInput): Promise<Result<FailedStepInput>> {
  return closeOnce(request, queueFailedStepAgain);
}

/** Closes a failure the owner does not want tried again, such as one for a form finished another way. */
export async function dismissFailedStep(request: FailedStepInput): Promise<Result<FailedStepInput>> {
  return closeOnce(request, closeFailedStep);
}

/** Both close the failure; of two requests at once, only the first does anything. */
async function closeOnce(
  request: FailedStepInput,
  close: typeof queueFailedStepAgain,
): Promise<Result<FailedStepInput>> {
  const input = FailedStepInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    if (!(await close(db, input.data.failedStepId))) return fail("conflict", "This was already dealt with.");
    return ok(input.data);
  } catch (error) {
    return fail("internal", describeError(error));
  }
}
