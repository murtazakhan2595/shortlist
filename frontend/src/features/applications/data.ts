import "server-only";
import { z } from "zod";
import { requireOwner } from "@/server/auth/require-owner";

// Data Access Layer for applications: the feature's reads, each starting with the owner check.

/** What the owner sees of a prepared application. */
export type ApplicationView = {
  status: string;
  recipientEmail: string | null;
  subject: string | null;
  body: string | null;
  presentedTitle: string | null;
  cvFileName: string | null;
  emailPattern: string | null;
  /** The problems that stopped a draft, one per line (X4). */
  blockedReason: string | null;
  /** True once the email is saved as a draft in the owner's Gmail (X1). */
  inGmail: boolean;
};

/** The application prepared from a capture, or null if there is none yet. */
export async function getApplicationForCapture(captureId: string): Promise<ApplicationView | null> {
  if (!z.uuid().safeParse(captureId).success) return null;

  const { db } = await requireOwner();
  const { data, error } = await db
    .from("applications")
    .select("status, recipient_email, subject, body, presented_title, blocked_reason, gmail_draft_id, cv_files (file_name), documents (name)")
    .eq("capture_id", captureId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the application for capture ${captureId}: ${error.message}`);
  if (!data) return null;

  return {
    status: data.status,
    recipientEmail: data.recipient_email,
    subject: data.subject,
    body: data.body,
    presentedTitle: data.presented_title,
    cvFileName: data.cv_files?.file_name ?? null,
    emailPattern: data.documents?.name ?? null,
    blockedReason: data.blocked_reason,
    inGmail: data.gmail_draft_id !== null,
  };
}
