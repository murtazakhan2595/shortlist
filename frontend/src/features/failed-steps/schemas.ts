import { z } from "zod";

// Contracts for the failed-steps feature (PLAN.md item 5.6): steps that failed every attempt, which the
// owner sees on the page of what they were working on, and can try again.
//
// Server Actions:
//   retryFailedStep(FailedStepInput)   -> Result<FailedStepInput>
//   dismissFailedStep(FailedStepInput) -> Result<FailedStepInput>

export const FailedStepInputSchema = z.object({ failedStepId: z.uuid() });
export type FailedStepInput = z.infer<typeof FailedStepInputSchema>;
