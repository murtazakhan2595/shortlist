import { z } from "zod";

// Server Actions:
//   retryFailedStep(FailedStepInput)   -> Result<FailedStepInput>
//   dismissFailedStep(FailedStepInput) -> Result<FailedStepInput>

export const FailedStepInputSchema = z.object({ failedStepId: z.uuid() });
export type FailedStepInput = z.infer<typeof FailedStepInputSchema>;
