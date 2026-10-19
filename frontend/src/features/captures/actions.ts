"use server";

import { randomUUID } from "node:crypto";
import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import {
  imageExtension,
  type ImageUploadRequest,
  ImageUploadRequestSchema,
  type SignedUpload,
} from "@/lib/uploads";
import { requireOwner } from "@/server/auth/require-owner";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import type { ServerClient } from "@/server/supabase/server";
import {
  type CaptureSubmitted,
  type ConfirmCaptureEmailInput,
  ConfirmCaptureEmailInputSchema,
  type SubmitCaptureInput,
  SubmitCaptureInputSchema,
} from "./schemas";

// Server Actions for capturing a post (contracts in ./schemas.ts). Each checks its input, checks the
// owner, and does one thing. Database writes use the owner's client, so the access rules apply too.

const SCREENSHOTS_BUCKET = "screenshots";

/** A one-time link the browser uploads a screenshot to, straight into private storage. */
export async function createCaptureUploadUrl(request: ImageUploadRequest): Promise<Result<SignedUpload>> {
  const input = ImageUploadRequestSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  // The server picks the name, so a request can never point at another file.
  const path = `captures/${randomUUID()}.${imageExtension(input.data.contentType)}`;
  const { data, error } = await db.storage.from(SCREENSHOTS_BUCKET).createSignedUploadUrl(path);
  if (error) return fail("internal", `Could not prepare the upload: ${error.message}`);

  return ok({ path: data.path, signedUrl: data.signedUrl });
}

/** Saves a pasted post or its screenshots as a new capture, and queues it to be read. */
export async function submitCapture(request: SubmitCaptureInput): Promise<Result<CaptureSubmitted>> {
  const input = SubmitCaptureInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    const captureId = await saveCapture(db, input.data);
    await enqueueStep(STEP_NAMES.extractCapture, { captureId });
    return ok({ captureId });
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

/** The owner confirms or corrects the email read from a screenshot, before anything is written (C4). */
export async function confirmCaptureEmail(request: ConfirmCaptureEmailInput): Promise<Result<CaptureSubmitted>> {
  const input = ConfirmCaptureEmailInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", "Enter a valid email address");

  const { db } = await requireOwner();
  const { data, error } = await db
    .from("captures")
    .update({ contact_email: input.data.email, email_confirmed: true, status: "processing" })
    .eq("id", input.data.captureId)
    .eq("status", "awaiting_confirmation")
    .select("id")
    .maybeSingle();
  if (error) return fail("internal", `Could not confirm the email: ${error.message}`);
  if (!data) return fail("conflict", "This post is not waiting for an email to be confirmed");

  try {
    await enqueueStep(STEP_NAMES.prepareEmailApplication, { captureId: data.id });
  } catch (error) {
    return fail("internal", describeError(error));
  }
  return ok({ captureId: data.id });
}

/** Each capture is its own run, so every model call made for it can be linked and costed (B1). */
async function saveCapture(db: ServerClient, input: SubmitCaptureInput): Promise<string> {
  const run = await db.from("runs").insert({ kind: "capture" }).select("id").single();
  if (run.error) throw new Error(`Could not start the capture's run: ${run.error.message}`);

  const post =
    input.inputType === "text"
      ? { input_type: "text" as const, raw_text: input.text }
      : { input_type: "screenshot" as const, image_paths: input.imagePaths };

  const capture = await db
    .from("captures")
    .insert({ ...post, post_url: input.postUrl ?? null, run_id: run.data.id })
    .select("id")
    .single();
  if (capture.error) throw new Error(`Could not save the capture: ${capture.error.message}`);
  return capture.data.id;
}
