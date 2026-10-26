import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imageContentType, imageExtension, type ImageUploadRequest, type SignedUpload } from "@/lib/uploads";
import type { ModelContentPart } from "@/server/models/messages";
import { getAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/server/supabase/database.types";

// Screenshots go to a model inside the request, so the provider is never given a link to private storage.

export type Screenshot = { mimeType: string; base64: string };

const SCREENSHOTS_BUCKET = "screenshots";

// The server picks the name, so a request can never point at another file.
export async function createScreenshotUploadUrl(
  db: SupabaseClient<Database>,
  folder: "captures" | "forms",
  contentType: ImageUploadRequest["contentType"],
): Promise<SignedUpload> {
  const path = `${folder}/${randomUUID()}.${imageExtension(contentType)}`;
  const { data, error } = await db.storage.from(SCREENSHOTS_BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Could not prepare the upload: ${error.message}`);
  return { path: data.path, signedUrl: data.signedUrl };
}

export async function downloadScreenshot(storagePath: string): Promise<Screenshot> {
  const mimeType = imageContentType(storagePath);
  if (!mimeType) throw new Error(`Unexpected screenshot type: ${storagePath}`);

  const { data, error } = await getAdminClient().storage.from(SCREENSHOTS_BUCKET).download(storagePath);
  if (error) throw new Error(`Could not download screenshot ${storagePath}: ${error.message}`);
  return { mimeType, base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
}

export function screenshotPart(screenshot: Screenshot): ModelContentPart {
  return { type: "image", url: `data:${screenshot.mimeType};base64,${screenshot.base64}` };
}
