import { z } from "zod";

// Contracts for the failed-steps feature (PLAN.md item 5.6): steps that failed every attempt, which the
// owner sees on the page of what they were working on, and can try again.
//
// Server Actions:
//   retryFailedStep(RetryFailedStepInput) -> Result<RetryFailedStepInput>

export const RetryFailedStepInputSchema = z.object({ failedStepId: z.uuid() });
export type RetryFailedStepInput = z.infer<typeof RetryFailedStepInputSchema>;
