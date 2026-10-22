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

function toOpenFailure(row: FailedStepRow): OpenFailure {
  const payload = row.payload !== null && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  const targetIds = PAYLOAD_IDS.flatMap((key) => {
    const value = payload[key];
    return typeof value === "string" ? [value] : [];
  });
  return { id: row.id, step: row.step, error: row.error, failedAt: row.failed_at, targetIds };
}

const QUEUE = "steps";

/**
 * The open failures of steps that worked on any of these captures, applications, listings or runs,
 * newest first. Takes the owner's client.
 */
export async function findOpenFailures(db: SupabaseClient<Database>, ids: string[]): Promise<OpenFailure[]> {
  // The ids go into the filter's text, so only ids that are uuids are used.
  const uuids = ids.filter((id) => z.uuid().safeParse(id).success);
  if (uuids.length === 0) return [];

  const list = uuids.join(",");
  const { data, error } = await db
    .from("failed_steps")
    .select("id, step, error, failed_at, payload")
    .eq("queue", QUEUE)
    .or(PAYLOAD_IDS.map((key) => `payload->>${key}.in.(${list})`).join(","))
    .order("failed_at", { ascending: false });
  if (error) throw new Error(`Could not look for failed steps: ${error.message}`);
  return data.map(toOpenFailure);
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

/** Closes a failure without trying the step again. Returns false if it was already closed. Takes the owner's client. */
export async function dismissFailedStep(db: SupabaseClient<Database>, failedStepId: string): Promise<boolean> {
  const { data, error } = await db.from("failed_steps").delete().eq("id", failedStepId).eq("queue", QUEUE).select("id");
  if (error) throw new Error(`Could not dismiss the failed step: ${error.message}`);
  return data.length > 0;
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
