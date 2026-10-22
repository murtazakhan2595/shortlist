import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignedUpload } from "@/lib/uploads";
import { getAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/server/supabase/database.types";

// The owner's CVs (P2), in the private "cvs" bucket. A new one is uploaded straight from the browser to a
// one-time link, then made the current CV of its kind; the old file is kept, as drafts point to it.

const CVS_BUCKET = "cvs";

/** A one-time link the browser uploads a CV to. The server picks the name. Takes the owner's client. */
export async function createCvUploadUrl(db: SupabaseClient<Database>): Promise<SignedUpload> {
  const path = `cvs/${randomUUID()}.pdf`;
  const { data, error } = await db.storage.from(CVS_BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Could not prepare the upload: ${error.message}`);
  return { path: data.path, signedUrl: data.signedUrl };
}

/**
 * Makes an uploaded CV the current one of its kind, and returns its id. Returns null if nothing was uploaded
 * to that path. Takes the owner's client for the check; the switch itself is a database function only
 * server code may call, so there is never a moment with no current CV, or two.
 */
export async function setCurrentCv(
  db: SupabaseClient<Database>,
  cv: { variant: string; fileName: string; storagePath: string },
): Promise<string | null> {
  // False for a file that is not there; any other problem throws.
  const { data: uploaded } = await db.storage.from(CVS_BUCKET).exists(cv.storagePath);
  if (!uploaded) return null;

  const { data, error } = await getAdminClient().rpc("set_current_cv", {
    cv_variant: cv.variant,
    cv_file_name: cv.fileName,
    cv_storage_path: cv.storagePath,
  });
  if (error) throw new Error(`Could not make the new ${cv.variant} CV current: ${error.message}`);
  return data;
}
