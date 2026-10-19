import "server-only";
import { z } from "zod";
import { jobKey } from "@/server/job-key";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";

// Queue step: start the application for a capture that has an email address (PLAN.md items 2.2, 2.6).
// Queued when a pasted post is read, or when the owner confirms a screenshot's email.
// Safe to run twice: a capture that already has its application only moves the writer on.

export const PrepareEmailApplicationPayloadSchema = z.object({ captureId: z.uuid() });

/**
 * The duplicate key for a captured job (C5, X6): the contact email in the company's place, as captures
 * often do not name the company. A reshare of the same post, to the same address for the same role,
 * gets the same key.
 */
export function captureFingerprint(contactEmail: string, role: string | null): string {
  return jobKey(contactEmail, role ?? "");
}

export async function prepareEmailApplication(payload: Json): Promise<void> {
  const { captureId } = PrepareEmailApplicationPayloadSchema.parse(payload);
  const db = getAdminClient();

  const capture = await db
    .from("captures")
    .select("id, status, contact_email, role, run_id")
    .eq("id", captureId)
    .single();
  if (capture.error) throw new Error(`Could not load capture ${captureId}: ${capture.error.message}`);
  const { status, contact_email: contactEmail, role, run_id: runId } = capture.data;
  if (status !== "processing" || !contactEmail) return;

  const fingerprint = captureFingerprint(contactEmail, role);
  const existing = await db.from("applications").select("id, capture_id").eq("fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`Could not look for an earlier application: ${existing.error.message}`);

  if (existing.data?.capture_id === captureId) {
    await enqueueStep(STEP_NAMES.advanceWriter, { applicationId: existing.data.id });
    return;
  }
  if (existing.data) {
    await markDuplicate(captureId);
    if (runId) await finishRun(runId);
    return;
  }

  // If another run of this step inserts first, the unique fingerprint makes this fail, and the retry
  // takes the branch above.
  const created = await db
    .from("applications")
    .insert({ capture_id: captureId, route: "email", recipient_email: contactEmail, fingerprint })
    .select("id")
    .single();
  if (created.error) throw new Error(`Could not start the application: ${created.error.message}`);

  await enqueueStep(STEP_NAMES.advanceWriter, { applicationId: created.data.id });
}

async function markDuplicate(captureId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("captures")
    .update({ status: "duplicate" })
    .eq("id", captureId)
    .eq("status", "processing");
  if (error) throw new Error(`Could not mark capture ${captureId} as a duplicate: ${error.message}`);
}
