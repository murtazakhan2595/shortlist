import { z } from "zod";
import type { OwnerMaterial } from "@/server/owner-material";

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

// Types the writer's files share (PLAN.md item 2.2).

/**
 * An email or a note as the writer produces it: the model writes it, code and a second model check it.
 * A note has no subject and no signature; both are empty.
 */
export type EmailDraft = {
  cvVariant: string;
  presentedTitle: string;
  emailPattern: string;
  subject: string;
  /** From the greeting to the last line before the sign-off. */
  body: string;
  /** The sign-off and the signature block. */
  signature: string;
};

/**
 * Everything a draft is written from: the post and the owner's material, loaded at every stage. The
 * material is the owner's (OwnerMaterial), with only the email patterns this route may follow.
 */
export type WriterContext = Omit<OwnerMaterial, "emailPatterns"> & {
  /**
   * "email": an email for a captured post with a contact address. "note": a short note the owner pastes
   * into the application of a listing that has only an apply link (X2, Q5).
   */
  route: "email" | "note";
  /** Model calls are linked to these, so each draft can be explained afterwards (B1). */
  link: { runId?: string; applicationId?: string };
  post: { text: string; role: string | null; company: string | null; posterName: string | null; seenOn: string };
  /** Always the address from the capture, never one a model wrote (principle 4). Null for a note. */
  recipientEmail: string | null;
  patterns: OwnerMaterial["emailPatterns"];
};

/** The payload of the queue steps that work on one application. */
export const ApplicationPayloadSchema = z.object({ applicationId: z.uuid() });
