import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Tables } from "@/server/supabase/database.types";
import { enqueueStep } from "./queue";

// Steps that failed every attempt. Retrying removes the row and queues the step again with the same payload.

export type OpenFailure = {
  id: string;
  step: string;
  error: string;
  failedAt: string;
  targetIds: string[];
};

const PAYLOAD_IDS = ["captureId", "applicationId", "listingId", "runId"] as const;

type FailedStepRow = Pick<Tables<"failed_steps">, "id" | "step" | "error" | "failed_at" | "payload">;

type PayloadIds = Partial<Record<(typeof PAYLOAD_IDS)[number], string>>;

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

// Open failures are few, so all are read and matched here. Putting the ids in the query made its URL
// grow with the list: 150 listings would pass the database API's URL limit.
export async function findOpenFailures(db: SupabaseClient<Database>, ids: string[]): Promise<OpenFailure[]> {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  return (await findAllOpenFailures(db)).filter((failure) => failure.targetIds.some((id) => wanted.has(id)));
}

export async function findAllOpenFailures(db: SupabaseClient<Database>): Promise<OpenFailure[]> {
  const { data, error } = await db
    .from("failed_steps")
    .select("id, step, error, failed_at, payload")
    .eq("queue", QUEUE)
    .order("failed_at", { ascending: false });
  if (error) throw new Error(`Could not load the failed steps: ${error.message}`);
  return data.map(toOpenFailure);
}

/** Returns false if it was already closed. */
export async function dismissFailedStep(db: SupabaseClient<Database>, failedStepId: string): Promise<boolean> {
  const { data, error } = await db.from("failed_steps").delete().eq("id", failedStepId).eq("queue", QUEUE).select("payload");
  if (error) throw new Error(`Could not dismiss the failed step: ${error.message}`);
  const [failure] = data;
  if (!failure) return false;
  await stopWaitingWork(db, payloadIds(failure.payload));
  return true;
}

export const DISMISSED_REASON = "A step failed and was dismissed, so this was not finished.";

// Otherwise the work would wait for the dismissed step for good. A listing needs nothing: its run went on
// without it when the step gave up.
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

// Removing the row is the claim: of two requests at once only one removes it, so the step is queued once.
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
    // Nothing would run the step, so the failure is put back.
    await db.from("failed_steps").insert(failure);
    throw queueError;
  }
  return true;
}
