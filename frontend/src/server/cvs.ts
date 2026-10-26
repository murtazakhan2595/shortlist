import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignedUpload } from "@/lib/uploads";
import { getAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/server/supabase/database.types";

// Old CV files are kept, as drafts point to them.

const CVS_BUCKET = "cvs";

export async function createCvUploadUrl(db: SupabaseClient<Database>): Promise<SignedUpload> {
  const path = `cvs/${randomUUID()}.pdf`;
  const { data, error } = await db.storage.from(CVS_BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Could not prepare the upload: ${error.message}`);
  return { path: data.path, signedUrl: data.signedUrl };
}

// Returns null if nothing was uploaded to that path. The switch is one database function, so there is
// never a moment with no current CV, or two.
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
