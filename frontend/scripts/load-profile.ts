// Loads the owner's Sprint 0 material from the private/ folder into Supabase (PLAN.md item 1.7).
//
//   pnpm profile:load
//
// Safe to run again: an unchanged file is skipped; a changed one is saved as a new version,
// and the old version is kept. Nothing from private/ ever enters the repository.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type AdminClient, getAdminClient } from "@/server/supabase/admin";
import { type CvSource, findCvSources, type ProfileDocument, readProfileDocuments } from "./profile-sources";

const PRIVATE_DIRECTORY = fileURLToPath(new URL("../../private", import.meta.url));
const CV_BUCKET = "cvs";

export type SaveOutcome = { status: "added" | "updated" | "unchanged"; version: number };

/** Saves the document as a new version unless its latest version already has the same content. */
export async function saveDocumentIfChanged(database: AdminClient, document: ProfileDocument): Promise<SaveOutcome> {
  const { data: current, error: readError } = await database
    .from("current_documents")
    .select("version, content")
    .eq("kind", document.kind)
    .eq("name", document.name)
    .maybeSingle();
  if (readError) throw new Error(`Could not read ${document.kind}/${document.name}: ${readError.message}`);

  const currentVersion = current?.version ?? 0;
  if (current?.content === document.content) return { status: "unchanged", version: currentVersion };

  const version = currentVersion + 1;
  const { error } = await database.from("documents").insert({ ...document, version });
  if (error) throw new Error(`Could not save ${document.kind}/${document.name}: ${error.message}`);

  return { status: current ? "updated" : "added", version };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Uploads the CV and makes it current for its variant, unless the current CV is the same file. */
export async function saveCvIfChanged(database: AdminClient, cv: CvSource): Promise<SaveOutcome["status"]> {
  const bytes = readFileSync(cv.filePath);

  const { data: current, error: readError } = await database
    .from("cv_files")
    .select("storage_path")
    .eq("variant", cv.variant)
    .eq("is_current", true)
    .maybeSingle();
  if (readError) throw new Error(`Could not read the current ${cv.variant} CV: ${readError.message}`);

  if (current) {
    const { data: stored, error } = await database.storage.from(CV_BUCKET).download(current.storage_path);
    if (error) throw new Error(`Could not read the stored ${cv.variant} CV: ${error.message}`);
    if (sha256(new Uint8Array(await stored.arrayBuffer())) === sha256(bytes)) return "unchanged";
  }

  const storagePath = `cvs/${randomUUID()}.pdf`;
  const { error: uploadError } = await database.storage
    .from(CV_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf" });
  if (uploadError) throw new Error(`Could not upload the ${cv.variant} CV: ${uploadError.message}`);

  const { error } = await database.rpc("set_current_cv", {
    cv_variant: cv.variant,
    cv_file_name: cv.fileName,
    cv_storage_path: storagePath,
  });
  if (error) throw new Error(`Could not make the new ${cv.variant} CV current: ${error.message}`);

  return current ? "updated" : "added";
}

async function main(): Promise<void> {
  const database = getAdminClient();

  for (const document of readProfileDocuments(PRIVATE_DIRECTORY)) {
    const { status, version } = await saveDocumentIfChanged(database, document);
    console.log(`${status.padEnd(9)} ${document.kind}/${document.name} (version ${version})`);
  }

  for (const cv of findCvSources(PRIVATE_DIRECTORY)) {
    console.log(`${(await saveCvIfChanged(database, cv)).padEnd(9)} CV ${cv.variant}`);
  }
}

if (import.meta.main) {
  await main();
}
