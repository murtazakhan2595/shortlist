"use server";

import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { type ImageUploadRequest, ImageUploadRequestSchema, type SignedUpload } from "@/lib/uploads";
import { requireOwner } from "@/server/auth/require-owner";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { createScreenshotUploadUrl } from "@/server/screenshots";
import type { ServerClient } from "@/server/supabase/server";
import { type CaptureSubmitted, type SubmitCaptureInput, SubmitCaptureInputSchema } from "./schemas";

// Server Actions for capturing a post (contracts in ./schemas.ts). Each checks its input, checks the
// owner, and does one thing. Database writes use the owner's client, so the access rules apply too.

/** A one-time link the browser uploads a screenshot to, straight into private storage. */
export async function createCaptureUploadUrl(request: ImageUploadRequest): Promise<Result<SignedUpload>> {
  const input = ImageUploadRequestSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    return ok(await createScreenshotUploadUrl(db, "captures", input.data.contentType));
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

/** Saves a pasted post or its screenshots as a new capture, and queues it to be read. */
export async function submitCapture(request: SubmitCaptureInput): Promise<Result<CaptureSubmitted>> {
  const input = SubmitCaptureInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    return ok({ captureId: await saveAndQueueCapture(db, input.data) });
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

/**
 * Saves the capture in a run of its own, so every model call made for it can be linked and costed (B1),
 * and queues it to be read. If a later part fails, the earlier ones are removed: nothing would ever read the
 * capture, and the owner can simply send it again.
 */
async function saveAndQueueCapture(db: ServerClient, input: SubmitCaptureInput): Promise<string> {
  const run = await db.from("runs").insert({ kind: "capture" }).select("id").single();
  if (run.error) throw new Error(`Could not start the capture's run: ${run.error.message}`);
  const runId = run.data.id;

  const post =
    input.inputType === "text"
      ? { input_type: "text" as const, raw_text: input.text }
      : { input_type: "screenshot" as const, image_paths: input.imagePaths };

  const capture = await db
    .from("captures")
    .insert({ ...post, post_url: input.postUrl ?? null, run_id: runId })
    .select("id")
    .single();
  if (capture.error) {
    await db.from("runs").delete().eq("id", runId);
    throw new Error(`Could not save the capture: ${capture.error.message}`);
  }

  const captureId = capture.data.id;
  try {
    await enqueueStep(STEP_NAMES.extractCapture, { captureId });
  } catch (error) {
    await db.from("captures").delete().eq("id", captureId);
    await db.from("runs").delete().eq("id", runId);
    throw error;
  }
  return captureId;
}
