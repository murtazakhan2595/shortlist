import "server-only";
import { createDraft, findDraft, getGmailAccessToken } from "@/server/gmail/gmail";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import { ApplicationPayloadSchema } from "../schemas";
import { claimLease, whileLeased } from "./writer-steps";

// Makes a Gmail draft with the CV attached. Ordinary code does this, never the model; nothing here sends.
// Safe to run twice: the lease stops two copies making two drafts, and if a call dies after Gmail made the
// draft but before its id was saved, the retry finds it by recipient and subject.

const CV_BUCKET = "cvs";

export async function createGmailDraft(payload: Json): Promise<void> {
  const { applicationId } = ApplicationPayloadSchema.parse(payload);
  const lease = await claimLease(applicationId);
  // Thrown, not skipped: the lease holder may stop before saving a draft, and then this one must still make it.
  if (!lease) throw new Error(`Application ${applicationId} is busy; the draft is tried again shortly`);
  await whileLeased(applicationId, lease, () => draftOnce(applicationId));
}

async function draftOnce(applicationId: string): Promise<void> {
  const db = getAdminClient();

  const application = await db
    .from("applications")
    .select("status, gmail_draft_id, recipient_email, subject, body, cv_files (file_name, storage_path)")
    .eq("id", applicationId)
    .single();
  if (application.error) throw new Error(`Could not load application ${applicationId}: ${application.error.message}`);
  const { status, gmail_draft_id: draftId, recipient_email: to, subject, body, cv_files: cv } = application.data;
  if (status !== "ready" || draftId) return;
  if (!to || !subject || !body || !cv) throw new Error(`Application ${applicationId} has no recipient, text or CV`);

  // Before Gmail is connected, ready applications wait; connecting queues them (queueMissingDrafts).
  const accessToken = await getGmailAccessToken();
  if (!accessToken) return;

  const gmailDraftId =
    (await findDraft(accessToken, to, subject)) ??
    (await createDraft(accessToken, {
      to,
      subject,
      body,
      attachment: { fileName: cv.file_name, contentType: "application/pdf", content: await downloadCv(cv.storage_path) },
    }));

  const saved = await db
    .from("applications")
    .update({ gmail_draft_id: gmailDraftId })
    .eq("id", applicationId)
    .is("gmail_draft_id", null);
  if (saved.error) throw new Error(`Could not save the Gmail draft id: ${saved.error.message}`);
}

/** Run when Gmail is connected. */
export async function queueMissingDrafts(): Promise<void> {
  const { data, error } = await getAdminClient()
    .from("applications")
    .select("id")
    .eq("route", "email")
    .eq("status", "ready")
    .is("gmail_draft_id", null);
  if (error) throw new Error(`Could not list applications without a draft: ${error.message}`);
  for (const { id } of data) await enqueueStep(STEP_NAMES.createGmailDraft, { applicationId: id });
}

async function downloadCv(storagePath: string): Promise<Buffer> {
  const { data, error } = await getAdminClient().storage.from(CV_BUCKET).download(storagePath);
  if (error) throw new Error(`Could not download the CV ${storagePath}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}
