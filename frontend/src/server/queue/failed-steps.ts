import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Tables } from "@/server/supabase/database.types";
import { enqueueStep } from "./queue";

// Steps that failed every attempt (PLAN.md item 5.6). The worker records each in failed_steps
// (run-next-step.ts). A failure stays open until the owner tries the step again: that removes its row
// and queues the step once more, with the same payload, so it carries on where it stopped.

export type OpenFailure = {
  id: string;
  step: string;
  error: string;
  failedAt: string;
  /** The captures, applications, listings or runs the step was working on, from its payload. */
  targetIds: string[];
};

// The ids a step's payload names what it works on by. A failure belongs to any of them.
const PAYLOAD_IDS = ["captureId", "applicationId", "listingId", "runId"] as const;

type FailedStepRow = Pick<Tables<"failed_steps">, "id" | "step" | "error" | "failed_at" | "payload">;

type PayloadIds = Partial<Record<(typeof PAYLOAD_IDS)[number], string>>;

/** The ids in a step's payload, by what they name. */
function payloadIds(payload: FailedStepRow["payload"]): PayloadIds {
  const fields = payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const ids: PayloadIds = {};
  for (const key of PAYLOAD_IDS) {
    const value = fields[key];
    if (typeof value === "string") ids[key] = value;
  }
  return ids;
}

function toOpenFailure(row: FailedStepRow): OpenFailure {
  const targetIds = Object.values(payloadIds(row.payload));
  return { id: row.id, step: row.step, error: row.error, failedAt: row.failed_at, targetIds };
}

const QUEUE = "steps";

/**
 * The open failures of steps that worked on any of these captures, applications, listings or runs,
 * newest first. Takes the owner's client.
 *
 * Open failures are few, so all are read and matched here. Putting the ids in the query instead made its
 * URL grow with the list: a night of 150 listings would pass the database API's limit.
 */
export async function findOpenFailures(db: SupabaseClient<Database>, ids: string[]): Promise<OpenFailure[]> {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  return (await findAllOpenFailures(db)).filter((failure) => failure.targetIds.some((id) => wanted.has(id)));
}

/** Every open failure, newest first. Takes the owner's client. */
export async function findAllOpenFailures(db: SupabaseClient<Database>): Promise<OpenFailure[]> {
  const { data, error } = await db
    .from("failed_steps")
    .select("id, step, error, failed_at, payload")
    .eq("queue", QUEUE)
    .order("failed_at", { ascending: false });
  if (error) throw new Error(`Could not load the failed steps: ${error.message}`);
  return data.map(toOpenFailure);
}

/**
 * Closes a failure without trying the step again, and stops what it was working on from waiting for it.
 * Returns false if it was already closed. Takes the owner's client.
 */
export async function dismissFailedStep(db: SupabaseClient<Database>, failedStepId: string): Promise<boolean> {
  const { data, error } = await db.from("failed_steps").delete().eq("id", failedStepId).eq("queue", QUEUE).select("payload");
  if (error) throw new Error(`Could not dismiss the failed step: ${error.message}`);
  const [failure] = data;
  if (!failure) return false;
  await stopWaitingWork(db, payloadIds(failure.payload));
  return true;
}

export const DISMISSED_REASON = "A step failed and was dismissed, so this was not finished.";

/**
 * What a dismissed step was working on would otherwise wait for it for good. Each is changed only while it
 * still waits: a form goes back to ready, so pages can be added again; an email or note is blocked, so it
 * can still be marked sent or skipped; a capture fails; a run fails. A listing needs nothing: its run went
 * on without it when the step gave up.
 */
async function stopWaitingWork(db: SupabaseClient<Database>, ids: PayloadIds): Promise<void> {
  const updates = [];
  if (ids.applicationId) {
    updates.push(
      db.from("applications").update({ status: "ready" }).eq("id", ids.applicationId).eq("route", "form").eq("status", "preparing"),
      db
        .from("applications")
        .update({ status: "blocked", blocked_reason: DISMISSED_REASON })
        .eq("id", ids.applicationId)
        .neq("route", "form")
        .eq("status", "preparing"),
    );
  }
  if (ids.captureId) {
    updates.push(db.from("captures").update({ status: "failed" }).eq("id", ids.captureId).eq("status", "processing"));
  }
  if (ids.runId) {
    updates.push(
      db.from("runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", ids.runId).eq("status", "running"),
    );
  }
  for (const { error } of await Promise.all(updates)) {
    if (error) throw new Error(`The failure was dismissed, but what it worked on is still waiting: ${error.message}`);
  }
}

const PayloadSchema = z.record(z.string(), z.json());

/**
 * Queues a failed step again with its payload, and closes the failure. Returns false if it was already
 * tried again. Removing the row is the claim: of two requests at once, only one removes it, so the step
 * is queued once. Takes the owner's client.
 */
export async function retryFailedStep(db: SupabaseClient<Database>, failedStepId: string): Promise<boolean> {
  const { data: failure, error } = await db
    .from("failed_steps")
    .delete()
    .eq("id", failedStepId)
    .eq("queue", QUEUE)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Could not reopen the failed step: ${error.message}`);
  if (!failure) return false;

  try {
    await enqueueStep(failure.step, PayloadSchema.parse(failure.payload));
  } catch (queueError) {
    // Nothing would run the step, so the failure is put back for the owner to try again.
    await db.from("failed_steps").insert(failure);
    throw queueError;
  }
  return true;
}
