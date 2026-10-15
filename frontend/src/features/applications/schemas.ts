import { z } from "zod";

// Contracts for the applications feature (PLAN.md item 1.3; U2, Q7).
//
// Server Actions:
//   updateApplicationStatus(UpdateApplicationStatusInput) -> Result<ApplicationStatusUpdated>

// The statuses the owner sets with one tap. The others (preparing, ready, blocked, failed) are set by the system.
export const OWNER_SET_STATUSES = ["sent", "skipped", "replied", "interview"] as const;

export const UpdateApplicationStatusInputSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum(OWNER_SET_STATUSES),
});
export type UpdateApplicationStatusInput = z.infer<typeof UpdateApplicationStatusInputSchema>;

export type ApplicationStatusUpdated = UpdateApplicationStatusInput;
