import "server-only";
import { z } from "zod";
import { jobKey } from "@/server/job-key";
import { getCheckpointer } from "@/server/queue/checkpointer";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import type { WriterContext } from "../schemas";
import { buildWriterGraph, START_STATE, type WriterStateValues, writerOutcome } from "./writer";

// The writer's two queue steps (PLAN.md items 2.2 and 2.6), in the order they run:
//
// 1. prepare_email_application: a capture with an email gets its application row, unless the same job
//    already has one (then the capture is a duplicate). Queued when a pasted post is read, or when the
//    owner confirms a screenshot's email.
// 2. advance_writer: runs the next stage of the writer's loop (writer.ts) and queues itself again, until
//    the loop ends and the application is saved as ready or blocked. One stage per call keeps every call
//    within the 25-second budget; LangGraph saves the loop's state in Postgres between calls.
//
// Both are safe to run twice. A capture that already has its application only moves the writer on. A call
// to advance_writer first claims a short lease on the application, and does nothing if it is taken; an
// extra call only moves the loop one stage further. If a call dies, its lease runs out and the queue's
// retry carries on from the last saved stage.

const ApplicationPayloadSchema = z.object({ applicationId: z.uuid() });
const CapturePayloadSchema = z.object({ captureId: z.uuid() });

// Longer than one stage (25 seconds), shorter than the queue's 60 seconds before a retry.
const LEASE_SECONDS = 45;

/** The email patterns for a captured post with an email (P7), named after the headings in
 * private/email-patterns.md. The others are for referrals and job-board notes. */
const CAPTURE_EMAIL_PATTERNS = ["post-reply", "proof-first-cold-email"];

// ---------------------------------------------------------------------------
// 1. prepare_email_application
// ---------------------------------------------------------------------------

export async function prepareEmailApplication(payload: Json): Promise<void> {
  const { captureId } = CapturePayloadSchema.parse(payload);
  const db = getAdminClient();

  const capture = await db.from("captures").select("status, contact_email, role, run_id").eq("id", captureId).single();
  if (capture.error) throw new Error(`Could not load capture ${captureId}: ${capture.error.message}`);
  const { status, contact_email: contactEmail, role, run_id: runId } = capture.data;
  if (status !== "processing" || !contactEmail) return;

  // The duplicate key (C5, X6) uses the contact email in the company's place, as captures often do not
  // name the company. A reshare of the same post, to the same address for the same role, gets the same key.
  const fingerprint = jobKey(contactEmail, role ?? "");
  const existing = await db.from("applications").select("id, capture_id").eq("fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`Could not look for an earlier application: ${existing.error.message}`);

  if (existing.data?.capture_id === captureId) {
    await enqueueStep(STEP_NAMES.advanceWriter, { applicationId: existing.data.id });
    return;
  }
  if (existing.data) {
    const duplicate = await db.from("captures").update({ status: "duplicate" }).eq("id", captureId).eq("status", "processing");
    if (duplicate.error) throw new Error(`Could not mark capture ${captureId} as a duplicate: ${duplicate.error.message}`);
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

// ---------------------------------------------------------------------------
// 2. advance_writer
// ---------------------------------------------------------------------------

export async function advanceWriter(payload: Json): Promise<void> {
  const { applicationId } = ApplicationPayloadSchema.parse(payload);
  if (!(await claimLease(applicationId))) return;

  let finished: boolean;
  try {
    finished = await runNextStage(applicationId);
  } finally {
    // Released before the next call is queued, so that call never finds the lease still held.
    await releaseLease(applicationId);
  }
  if (!finished) await enqueueStep(STEP_NAMES.advanceWriter, { applicationId });
}

/** Runs one stage, or saves the outcome once the loop has ended. True when nothing is left to do. */
async function runNextStage(applicationId: string): Promise<boolean> {
  const application = await getAdminClient()
    .from("applications")
    .select("status, recipient_email, captures (id, run_id, raw_text, role, company, poster_name)")
    .eq("id", applicationId)
    .single();
  if (application.error) throw new Error(`Could not load application ${applicationId}: ${application.error.message}`);
  const { status, recipient_email: recipientEmail, captures: capture } = application.data;
  if (status !== "preparing") return true;
  if (!capture?.raw_text || !recipientEmail) throw new Error(`Application ${applicationId} has no post text or recipient`);

  const writer: WriterContext = {
    ...(await loadOwnerMaterial()),
    link: { runId: capture.run_id ?? undefined, applicationId },
    post: {
      text: capture.raw_text,
      role: capture.role,
      company: capture.company,
      posterName: capture.poster_name,
      seenOn: "LinkedIn",
    },
    recipientEmail,
  };

  const graph = buildWriterGraph(getCheckpointer());
  const thread = { configurable: { thread_id: applicationId } };
  const saved = await graph.getState(thread);
  const isNew = !saved.metadata;

  if (isNew || saved.next.length > 0) {
    // interruptAfter "*" pauses after every stage, so this call runs exactly one.
    await graph.invoke(isNew ? START_STATE : null, { ...thread, context: { writer, models: undefined }, interruptAfter: "*" });
  }
  const after = await graph.getState(thread);
  if (after.next.length > 0) return false;

  await saveOutcome(applicationId, writer, after.values);
  const done = await getAdminClient().from("captures").update({ status: "done" }).eq("id", capture.id).eq("status", "processing");
  if (done.error) throw new Error(`Could not close capture ${capture.id}: ${done.error.message}`);
  if (capture.run_id) await finishRun(capture.run_id);
  return true;
}

/** Saves the last draft, as ready, or as blocked with the problems that stopped it. */
async function saveOutcome(applicationId: string, writer: WriterContext, state: WriterStateValues): Promise<void> {
  const db = getAdminClient();
  const outcome = writerOutcome(state);
  const { draft } = state;

  const cvFile = draft
    ? await db.from("cv_files").select("id").eq("variant", draft.cvVariant).eq("is_current", true).maybeSingle()
    : undefined;
  if (cvFile?.error) throw new Error(`Could not find the chosen CV: ${cvFile.error.message}`);

  const { error } = await db
    .from("applications")
    .update({
      status: outcome,
      subject: draft?.subject ?? null,
      body: draft ? `${draft.body}\n\n${draft.signature}` : null,
      presented_title: draft?.presentedTitle ?? null,
      cv_file_id: cvFile?.data?.id ?? null,
      email_pattern_id: writer.patterns.find((pattern) => pattern.name === draft?.emailPattern)?.id ?? null,
      blocked_reason: outcome === "blocked" ? state.problems.join("\n") : null,
    })
    .eq("id", applicationId)
    .eq("status", "preparing");
  if (error) throw new Error(`Could not save application ${applicationId}: ${error.message}`);
}

async function claimLease(applicationId: string): Promise<boolean> {
  const now = new Date();
  const { data, error } = await getAdminClient()
    .from("applications")
    .update({ writer_lease_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString() })
    .eq("id", applicationId)
    .or(`writer_lease_until.is.null,writer_lease_until.lt.${now.toISOString()}`)
    .select("id");
  if (error) throw new Error(`Could not claim application ${applicationId}: ${error.message}`);
  return data.length > 0;
}

async function releaseLease(applicationId: string): Promise<void> {
  const { error } = await getAdminClient().from("applications").update({ writer_lease_until: null }).eq("id", applicationId);
  if (error) throw new Error(`Could not release application ${applicationId}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// The owner's material, the same for every application. Loaded at every stage rather than kept in the
// saved state, so that state stays small and each stage uses the latest version of the profile.
// ---------------------------------------------------------------------------

export async function loadOwnerMaterial(): Promise<Omit<WriterContext, "link" | "post" | "recipientEmail">> {
  const db = getAdminClient();
  const [documents, cvFiles] = await Promise.all([
    db.from("current_documents").select("id, kind, name, content").order("name"),
    db.from("cv_files").select("variant").eq("is_current", true).order("variant"),
  ]);
  if (documents.error) throw new Error(`Could not load the owner's documents: ${documents.error.message}`);
  if (cvFiles.error) throw new Error(`Could not load the CV list: ${cvFiles.error.message}`);

  const ofKind = (kind: string) =>
    documents.data.flatMap(({ id, kind: documentKind, name, content }) =>
      documentKind === kind && id && name && content ? [{ id, name, content }] : [],
    );
  const answerBank = ofKind("answer_bank").find((document) => document.name === "main")?.content;
  const writingGuide = ofKind("email_pattern").find((document) => document.name === "writing-guide")?.content;
  const patterns = ofKind("email_pattern").filter((document) => CAPTURE_EMAIL_PATTERNS.includes(document.name));
  const profile = ofKind("profile").map((document) => `## ${document.name}\n\n${document.content}`);

  if (profile.length === 0 || !answerBank || !writingGuide || patterns.length === 0 || cvFiles.data.length === 0) {
    throw new Error("The owner's material is incomplete: run pnpm profile:load");
  }
  return {
    profile: profile.join("\n\n"),
    answerBank,
    writingGuide,
    voiceExamples: ofKind("voice_example").map((document) => document.content),
    patterns,
    cvVariants: cvFiles.data.map((file) => file.variant),
  };
}
