import { z } from "zod";
import type { OwnerMaterial } from "@/server/owner-material";

// Server Actions:
//   updateApplicationStatus(UpdateApplicationStatusInput) -> Result<UpdateApplicationStatusInput>

// The others (preparing, ready, blocked, failed) are set by the system.
export const OWNER_SET_STATUSES = ["sent", "skipped", "replied", "interview"] as const;

export const UpdateApplicationStatusInputSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum(OWNER_SET_STATUSES),
});
export type UpdateApplicationStatusInput = z.infer<typeof UpdateApplicationStatusInputSchema>;


export const DAILY_LIST_DAYS = 7;

export type EmailDraft = {
  cvVariant: string;
  presentedTitle: string;
  emailPattern: string;
  subject: string;
  /** From the greeting to the last line before the sign-off. */
  body: string;
  signature: string;
};

export type WriterContext = Omit<OwnerMaterial, "emailPatterns"> & {
  /** Model calls are linked to these, so each draft's cost can be traced. */
  link: { runId?: string; applicationId?: string };
  post: { text: string; role: string | null; company: string | null; posterName: string | null; seenOn: string };
  /** Always the address code read from the post, never one a model wrote. */
  recipientEmail: string;
  patterns: OwnerMaterial["emailPatterns"];
};

export const ApplicationPayloadSchema = z.object({ applicationId: z.uuid() });
