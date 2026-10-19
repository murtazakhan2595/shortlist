import "server-only";
import { z } from "zod";
import { imageContentType } from "@/lib/uploads";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json, Tables } from "@/server/supabase/database.types";
import { type ExtractedPost, type PostImage, type PostInput, readPost } from "./read-post";

// Queue step: read a captured post and save what it says (PLAN.md item 2.1).
// Queued when a capture is submitted (item 2.4). Safe to run twice: a capture is read only once.
// A post with an email from pasted text is handed to the writer.

export const ExtractCapturePayloadSchema = z.object({ captureId: z.uuid() });

type Capture = Tables<"captures">;
type CaptureStatus = "processing" | "awaiting_confirmation" | "needs_form" | "no_contact";

const SCREENSHOTS_BUCKET = "screenshots";

export async function extractCapture(payload: Json): Promise<void> {
  const { captureId } = ExtractCapturePayloadSchema.parse(payload);
  const capture = await loadCapture(captureId);
  const status = capture.status === "received" ? await readAndSave(capture) : capture.status;

  // The hand-offs run again if this step is retried, so each is safe to repeat: the writer skips a
  // capture that already has an application, and finishing a run twice changes nothing.
  if (status === "processing") await enqueueStep(STEP_NAMES.prepareEmailApplication, { captureId });
  // Nothing more happens for a post without an email or a form, so its run ends here.
  if (status === "no_contact" && capture.run_id) await finishRun(capture.run_id);
}

async function readAndSave(capture: Capture): Promise<CaptureStatus> {
  const post = await toPostInput(capture);
  const details = await readPost(post, { link: { runId: capture.run_id ?? undefined } });
  const status = statusAfterReading(details, post.kind);
  await saveDetails(capture.id, details, status);
  return status;
}

/**
 * Where the capture goes next. An email from pasted text is checked against the post, so writing can
 * start; one read from a screenshot waits for the owner to confirm it (C4).
 */
export function statusAfterReading(details: ExtractedPost, kind: PostInput["kind"]): CaptureStatus {
  if (details.contactEmail) return kind === "text" ? "processing" : "awaiting_confirmation";
  if (details.formUrl) return "needs_form";
  return "no_contact";
}

async function loadCapture(captureId: string): Promise<Capture> {
  const { data, error } = await getAdminClient().from("captures").select("*").eq("id", captureId).single();
  if (error) throw new Error(`Could not load capture ${captureId}: ${error.message}`);
  return data;
}

async function toPostInput(capture: Capture): Promise<PostInput> {
  if (capture.input_type === "text") {
    if (!capture.raw_text) throw new Error(`Capture ${capture.id} has no text`);
    return { kind: "text", text: capture.raw_text };
  }
  return { kind: "screenshots", images: await Promise.all(capture.image_paths.map(downloadImage)) };
}

/** Screenshots go to the model inside the request, so the provider is never given a link to private storage. */
async function downloadImage(storagePath: string): Promise<PostImage> {
  const mimeType = imageContentType(storagePath);
  if (!mimeType) throw new Error(`Unexpected screenshot type: ${storagePath}`);

  const { data, error } = await getAdminClient().storage.from(SCREENSHOTS_BUCKET).download(storagePath);
  if (error) throw new Error(`Could not download screenshot ${storagePath}: ${error.message}`);
  return { mimeType, base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
}

async function saveDetails(captureId: string, details: ExtractedPost, status: CaptureStatus): Promise<void> {
  const { error } = await getAdminClient()
    .from("captures")
    .update({
      role: details.role,
      company: details.company,
      poster_name: details.posterName,
      contact_email: details.contactEmail,
      form_url: details.formUrl,
      // For screenshots, the text read from them, so later steps can use the whole post.
      ...(details.postText ? { raw_text: details.postText } : {}),
      status,
    })
    .eq("id", captureId)
    // Only a capture that has not been read yet, so a second run of this step changes nothing.
    .eq("status", "received");
  if (error) throw new Error(`Could not save capture ${captureId}: ${error.message}`);
}
