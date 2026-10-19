import "server-only";
import { createDraft, findDraft, getGmailAccessToken } from "@/server/gmail/gmail";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import { ApplicationPayloadSchema } from "../schemas";

// create_gmail_draft (PLAN.md item 2.3, X1): a ready application becomes a draft in the owner's Gmail,
// with the chosen CV attached. Queued by advance_writer when the writer's loop ends with a ready email.
// The owner reads the draft in Gmail and sends it; nothing here sends (hard rule 1).
//
// Safe to run twice (AGENTS.md rule 7). A step that finds gmail_draft_id set does nothing. If a call dies
// after Gmail made the draft but before its id was saved, the retry finds that draft by its Message-ID
// instead of making a second one.

const CV_BUCKET = "cvs";

export async function createGmailDraft(payload: Json): Promise<void> {
  const { applicationId } = ApplicationPayloadSchema.parse(payload);
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

  const messageId = `<application-${applicationId}@shortlist.local>`;
  const gmailDraftId =
    (await findDraft(accessToken, messageId)) ??
    (await createDraft(accessToken, {
      messageId,
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

/** Queues a draft for every ready application without one. Run when the owner connects Gmail. */
export async function queueMissingDrafts(): Promise<void> {
  const { data, error } = await getAdminClient()
    .from("applications")
    .select("id")
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
