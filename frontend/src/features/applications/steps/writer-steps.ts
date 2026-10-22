import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { jobKey } from "@/server/job-key";
import { loadOwnerMaterial } from "@/server/owner-material";
import { getCheckpointer } from "@/server/queue/checkpointer";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json, Tables } from "@/server/supabase/database.types";
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
// retry carries on from the last saved stage. create_gmail_draft takes the same lease (gmail-draft.ts).

const CapturePayloadSchema = z.object({ captureId: z.uuid() });
const ListingPayloadSchema = z.object({ listingId: z.uuid() });

// Longer than one stage (60 seconds), shorter than the queue's 90 seconds before a retry.
const LEASE_SECONDS = 75;

// A long job description is cut, as for scoring (score-listings.ts), so one listing cannot make every
// write and check call slow or dear.
const MAX_DESCRIPTION_LENGTH = 15_000;

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

  const capture = await db.from("captures").select("status, contact_email, role, raw_text, run_id").eq("id", captureId).single();
  if (capture.error) throw new Error(`Could not load capture ${captureId}: ${capture.error.message}`);
  const { status, contact_email: contactEmail, role, raw_text: postText, run_id: runId } = capture.data;
  if (status !== "processing" || !contactEmail) return;

  const fingerprint = captureFingerprint(contactEmail, role, postText ?? "");
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

/**
 * The duplicate key (C5, X6) uses the contact email in the company's place, as captures often do not name
 * the company. A reshare of the same post, to the same address for the same role, gets the same key.
 * Without a role, the post's own text stands in for it, so two different jobs at one address are not
 * taken for one.
 */
export function captureFingerprint(contactEmail: string, role: string | null, postText: string): string {
  if (role) return jobKey(contactEmail, role);
  const words = postText.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return jobKey(contactEmail, `post-${createHash("sha1").update(words).digest("hex").slice(0, 12)}`);
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
  const lease = await claimLease(applicationId);
  if (!lease) return;

  // The next step is queued once the lease is released, so it never finds the lease still held.
  const next = await whileLeased(applicationId, lease, () => runNextStage(applicationId));
  if (next) await enqueueStep(next, { applicationId });
}

/**
 * Runs one stage, or saves the outcome once the loop has ended. Returns the step that comes next for the
 * application: another stage, the Gmail draft of a ready email, or none.
 */
async function runNextStage(applicationId: string): Promise<string | null> {
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
    if (outcome === "preparing") return STEP_NAMES.advanceWriter;
  }
  // A note is done once saved. Also reached when a retry finds the outcome already saved, so a call that
  // died here still hands off.
  if (!capture) return null;
  await finishCapture(capture);
  return outcome === "ready" ? STEP_NAMES.createGmailDraft : null;
}

type CaptureForWriter = Pick<Tables<"captures">, "id" | "run_id" | "raw_text" | "role" | "company" | "poster_name">;
type ListingForWriter = Pick<Tables<"listings">, "run_id" | "title" | "company" | "location" | "description">;

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
      text: `${listing.title} at ${listing.company}\nLocation: ${listing.location ?? "not stated"}\n\n${listing.description.slice(0, MAX_DESCRIPTION_LENGTH)}`,
      role: listing.title,
      company: listing.company,
      posterName: null,
      seenOn: "Himalayas",
    },
    recipientEmail: null,
  };
}

/** The capture is closed and its run finished. */
async function finishCapture(capture: CaptureForWriter): Promise<void> {
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

// ---------------------------------------------------------------------------
// The lease: one worker at a time on an application
// ---------------------------------------------------------------------------

/** Claims the application for LEASE_SECONDS. Returns the lease, or null if another worker holds it. */
export async function claimLease(applicationId: string): Promise<string | null> {
  const now = new Date();
  const { data, error } = await getAdminClient()
    .from("applications")
    .update({ writer_lease_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString() })
    .eq("id", applicationId)
    .or(`writer_lease_until.is.null,writer_lease_until.lt.${now.toISOString()}`)
    .select("writer_lease_until")
    .maybeSingle();
  if (error) throw new Error(`Could not claim application ${applicationId}: ${error.message}`);
  return data?.writer_lease_until ?? null;
}

/**
 * Runs the work, then releases the lease. Only this lease is released: one that ran out and was claimed by
 * another worker stays theirs. If the work fails, its error is the one passed on, even if releasing fails too.
 */
export async function whileLeased<T>(applicationId: string, lease: string, work: () => Promise<T>): Promise<T> {
  const release = () =>
    getAdminClient().from("applications").update({ writer_lease_until: null }).eq("id", applicationId).eq("writer_lease_until", lease);

  let result: T;
  try {
    result = await work();
  } catch (error) {
    // Left unreleased if this fails, the lease runs out on its own; the work's error says more.
    await release();
    throw error;
  }
  const { error } = await release();
  if (error) throw new Error(`Could not release application ${applicationId}: ${error.message}`);
  return result;
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
