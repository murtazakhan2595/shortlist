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

// Database writes use the owner's client, so the access rules apply too.

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
 * A run of its own, so every model call made for it can be costed. If a later part fails, the earlier ones
 * are removed: nothing would ever read the capture, and it can simply be sent again.
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
