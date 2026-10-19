import "server-only";
import { z } from "zod";
import { getCheckpointer } from "@/server/queue/checkpointer";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import { buildWriterGraph, START_STATE, type WriterStateValues, writerOutcome } from "./writer-graph";
import { loadWriterContext, type WriterContext } from "./writer-context";

// Queue step: run the next stage of the writer's loop for one application (PLAN.md item 2.2).
//
// Each call runs one stage (write, code check or model check) and LangGraph saves the state in
// Postgres, so every call stays within the 25-second budget. Then it queues itself again, until the
// loop ends and the application is saved as ready or blocked.
//
// Safe to run twice: a call first claims a short lease on the application, and a call that finds the
// lease taken does nothing. An extra call only moves the loop one stage further, which is what it is
// for. If a call dies, its lease runs out and the queue's retry carries on from the last saved stage.

export const AdvanceWriterPayloadSchema = z.object({ applicationId: z.uuid() });

// Longer than one stage (25 seconds), shorter than the queue's 60 seconds before a retry.
const LEASE_SECONDS = 45;

export async function advanceWriter(payload: Json): Promise<void> {
  const { applicationId } = AdvanceWriterPayloadSchema.parse(payload);
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

/** Runs one stage, or saves the outcome if the loop has ended. True when nothing is left to do. */
async function runNextStage(applicationId: string): Promise<boolean> {
  const application = await getAdminClient()
    .from("applications")
    .select("status, capture_id")
    .eq("id", applicationId)
    .single();
  if (application.error) throw new Error(`Could not load application ${applicationId}: ${application.error.message}`);
  if (application.data.status !== "preparing") return true;

  const graph = buildWriterGraph(getCheckpointer());
  const thread = { configurable: { thread_id: applicationId } };
  const writer = await loadWriterContext(applicationId);

  const saved = await graph.getState(thread);
  const isNew = !saved.metadata;
  const captureId = application.data.capture_id;
  if (!isNew && saved.next.length === 0) {
    await saveOutcome(writer, captureId, saved.values);
    return true;
  }

  // interruptAfter "*" pauses after every stage, so one call runs exactly one.
  await graph.invoke(isNew ? START_STATE : null, { ...thread, context: { writer, models: undefined }, interruptAfter: "*" });

  const after = await graph.getState(thread);
  if (after.next.length > 0) return false;
  await saveOutcome(writer, captureId, after.values);
  return true;
}

/** Saves the last draft, as ready or blocked with its problems, and closes the capture and its run. */
async function saveOutcome(writer: WriterContext, captureId: string | null, state: WriterStateValues): Promise<void> {
  const db = getAdminClient();
  const applicationId = writer.link.applicationId;
  if (!applicationId) throw new Error("The writer's context has no application");

  const outcome = writerOutcome(state);
  const draft = state.draft;
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

  if (captureId) {
    const done = await db.from("captures").update({ status: "done" }).eq("id", captureId).eq("status", "processing");
    if (done.error) throw new Error(`Could not close capture ${captureId}: ${done.error.message}`);
  }
  if (writer.link.runId) await finishRun(writer.link.runId);
}

async function claimLease(applicationId: string): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_SECONDS * 1000);
  const { data, error } = await getAdminClient()
    .from("applications")
    .update({ writer_lease_until: until.toISOString() })
    .eq("id", applicationId)
    .or(`writer_lease_until.is.null,writer_lease_until.lt.${now.toISOString()}`)
    .select("id");
  if (error) throw new Error(`Could not claim application ${applicationId}: ${error.message}`);
  return data.length > 0;
}

async function releaseLease(applicationId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("applications")
    .update({ writer_lease_until: null })
    .eq("id", applicationId);
  if (error) throw new Error(`Could not release application ${applicationId}: ${error.message}`);
}
