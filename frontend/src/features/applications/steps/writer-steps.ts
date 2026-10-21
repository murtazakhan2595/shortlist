import "server-only";
import { z } from "zod";
import { jobKey } from "@/server/job-key";
import { loadOwnerMaterial } from "@/server/owner-material";
import { getCheckpointer } from "@/server/queue/checkpointer";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import { ApplicationPayloadSchema, type WriterContext } from "../schemas";
import { buildWriterGraph, START_STATE, type WriterStateValues, writerOutcome } from "./writer";

// The writer's queue steps (PLAN.md items 2.2, 2.6 and 4.6), in the order they run:
//
// 1. prepare_email_application: a capture with an email gets its application row, unless the same job
//    already has one (then the capture is a duplicate). Queued when a post is read.
//    prepare_note_application: a listing in its night's top N gets its application row, a note to paste
//    when applying through its link (X2), unless the same job already has one. Queued by select_top_listings.
// 2. advance_writer: runs the next stage of the writer's loop (writer.ts) and queues itself again, until
//    the loop ends and the application is saved as ready or blocked. A ready email goes on to
//    create_gmail_draft (gmail-draft.ts); a note is done. One stage per call keeps every call
//    within the 60-second budget; LangGraph saves the loop's state in Postgres between calls.
//
// All are safe to run twice. A capture or listing that already has its application only moves the writer on. A call
// to advance_writer first claims a short lease on the application, and does nothing if it is taken; an
// extra call only moves the loop one stage further. If a call dies, its lease runs out and the queue's
// retry carries on from the last saved stage.

const CapturePayloadSchema = z.object({ captureId: z.uuid() });
const ListingPayloadSchema = z.object({ listingId: z.uuid() });

// Longer than one stage (60 seconds), shorter than the queue's 90 seconds before a retry.
const LEASE_SECONDS = 75;

/** The patterns each route may follow (P7), named after the headings in private/email-patterns.md.
 * The referral pattern is not used by the writer. */
const PATTERNS_BY_ROUTE: Record<WriterContext["route"], string[]> = {
  email: ["post-reply", "proof-first-cold-email"],
  note: ["job-board-note"],
};

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
// 1. prepare_note_application
// ---------------------------------------------------------------------------

export async function prepareNoteApplication(payload: Json): Promise<void> {
  const { listingId } = ListingPayloadSchema.parse(payload);
  const db = getAdminClient();

  const listing = await db.from("listings").select("fingerprint, top_rank").eq("id", listingId).maybeSingle();
  if (listing.error) throw new Error(`Could not load listing ${listingId}: ${listing.error.message}`);
  if (!listing.data?.top_rank) return;

  // The listing's own duplicate key (D2, X6), so the same job gets one application from any source.
  const { fingerprint } = listing.data;
  const existing = await db.from("applications").select("id, listing_id").eq("fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`Could not look for an earlier application: ${existing.error.message}`);
  if (existing.data?.listing_id === listingId) {
    await enqueueStep(STEP_NAMES.advanceWriter, { applicationId: existing.data.id });
    return;
  }
  if (existing.data) return;

  // If another run of this step inserts first, the unique fingerprint makes this fail, and the retry
  // takes the branch above.
  const created = await db
    .from("applications")
    .insert({ listing_id: listingId, route: "note", fingerprint })
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
    .select(
      "status, recipient_email, captures (id, run_id, raw_text, role, company, poster_name), listings (run_id, title, company, location, description)",
    )
    .eq("id", applicationId)
    .single();
  if (application.error) throw new Error(`Could not load application ${applicationId}: ${application.error.message}`);
  const { status, recipient_email: recipientEmail, captures: capture, listings: listing } = application.data;

  let outcome = status;
  if (status === "preparing") {
    const writer = capture
      ? await emailWriter(applicationId, capture, recipientEmail)
      : await noteWriter(applicationId, listing);
    outcome = await runOneStage(applicationId, writer);
    if (outcome === "preparing") return false;
  }
  // A note is done once saved. Also reached when a retry finds the outcome already saved, so a call that
  // died here still hands off.
  if (capture) await finishCapture(applicationId, outcome, capture);
  return true;
}

type CaptureForWriter = { id: string; run_id: string | null; raw_text: string | null; role: string | null; company: string | null; poster_name: string | null };
type ListingForWriter = { run_id: string | null; title: string; company: string; location: string | null; description: string };

async function emailWriter(applicationId: string, capture: CaptureForWriter, recipientEmail: string | null): Promise<WriterContext> {
  if (!capture.raw_text || !recipientEmail) throw new Error(`Application ${applicationId} has no post text or recipient`);
  return {
    ...(await loadWriterMaterial("email")),
    route: "email",
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
}

async function noteWriter(applicationId: string, listing: ListingForWriter | null): Promise<WriterContext> {
  if (!listing) throw new Error(`Application ${applicationId} has no capture or listing`);
  return {
    ...(await loadWriterMaterial("note")),
    route: "note",
    link: { runId: listing.run_id ?? undefined, applicationId },
    post: {
      text: `${listing.title} at ${listing.company}\nLocation: ${listing.location ?? "not stated"}\n\n${listing.description}`,
      role: listing.title,
      company: listing.company,
      posterName: null,
      seenOn: "Himalayas",
    },
    recipientEmail: null,
  };
}

/** A ready email goes on to its Gmail draft; the capture is closed and its run finished. */
async function finishCapture(applicationId: string, outcome: string, capture: CaptureForWriter): Promise<void> {
  if (outcome === "ready") await enqueueStep(STEP_NAMES.createGmailDraft, { applicationId });
  const done = await getAdminClient().from("captures").update({ status: "done" }).eq("id", capture.id).eq("status", "processing");
  if (done.error) throw new Error(`Could not close capture ${capture.id}: ${done.error.message}`);
  if (capture.run_id) await finishRun(capture.run_id);
}

/** Runs the loop's next stage, and saves the outcome once the loop has ended. Returns the application's status. */
async function runOneStage(applicationId: string, writer: WriterContext): Promise<string> {
  const graph = buildWriterGraph(getCheckpointer());
  const thread = { configurable: { thread_id: applicationId } };
  const saved = await graph.getState(thread);
  const isNew = !saved.metadata;

  if (isNew || saved.next.length > 0) {
    // interruptAfter "*" pauses after every stage, so this call runs exactly one.
    await graph.invoke(isNew ? START_STATE : null, { ...thread, context: { writer, models: undefined }, interruptAfter: "*" });
  }
  const after = await graph.getState(thread);
  if (after.next.length > 0) return "preparing";
  return saveOutcome(applicationId, writer, after.values);
}

/** Saves the last draft, as ready, or as blocked with the problems that stopped it. */
async function saveOutcome(applicationId: string, writer: WriterContext, state: WriterStateValues): Promise<string> {
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
      subject: draft?.subject || null,
      body: draft ? [draft.body, draft.signature].filter(Boolean).join("\n\n") : null,
      presented_title: draft?.presentedTitle ?? null,
      cv_file_id: cvFile?.data?.id ?? null,
      email_pattern_id: writer.patterns.find((pattern) => pattern.name === draft?.emailPattern)?.id ?? null,
      blocked_reason: outcome === "blocked" ? state.problems.join("\n") : null,
    })
    .eq("id", applicationId)
    .eq("status", "preparing");
  if (error) throw new Error(`Could not save application ${applicationId}: ${error.message}`);
  return outcome;
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

/** The owner's material, with the patterns the route can follow. */
export async function loadWriterMaterial(
  route: WriterContext["route"],
): Promise<Omit<WriterContext, "route" | "link" | "post" | "recipientEmail">> {
  const { emailPatterns, ...material } = await loadOwnerMaterial();
  const patterns = emailPatterns.filter((pattern) => PATTERNS_BY_ROUTE[route].includes(pattern.name));
  if (patterns.length === 0) throw new Error(`No ${route} pattern is stored: add one on the Profile page`);
  return { ...material, patterns };
}
