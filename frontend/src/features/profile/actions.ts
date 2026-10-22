"use server";

import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { type PdfUploadRequest, PdfUploadRequestSchema, type SignedUpload } from "@/lib/uploads";
import { requireOwner } from "@/server/auth/require-owner";
import { createCvUploadUrl as createCvUpload, setCurrentCv } from "@/server/cvs";
import { saveDocumentIfChanged } from "@/server/documents";
import {
  type CvFileSaved,
  type DocumentSaved,
  type SaveCvFileInput,
  SaveCvFileInputSchema,
  type SaveDocumentInput,
  SaveDocumentInputSchema,
} from "./schemas";

// Server Actions for the owner's material (contracts in ./schemas.ts). Writes use the owner's client, so
// the access rules apply too.

/** Saves an edited document as a new version; the old version is kept (P6, Q8). */
export async function saveDocument(request: SaveDocumentInput): Promise<Result<DocumentSaved>> {
  const input = SaveDocumentInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { baseVersion, ...document } = input.data;
  try {
    const { status, documentId, version } = await saveDocumentIfChanged(db, document, baseVersion);
    if (status === "conflict") {
      return fail(
        "conflict",
        `This document changed after you opened it (it is now version ${version}). Copy your edit, reload the page, and make it again.`,
      );
    }
    return ok({ documentId, version });
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

/** A one-time link the browser uploads a new CV to, straight into private storage (P2). */
export async function createCvUploadUrl(request: PdfUploadRequest): Promise<Result<SignedUpload>> {
  const input = PdfUploadRequestSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    return ok(await createCvUpload(db));
  } catch (error) {
    return fail("internal", describeError(error));
  }
}

/** Makes an uploaded CV the current one of its kind. Drafts already made keep the CV they were made with. */
export async function saveCvFile(request: SaveCvFileInput): Promise<Result<CvFileSaved>> {
  const input = SaveCvFileInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    const cvFileId = await setCurrentCv(db, input.data);
    if (!cvFileId) return fail("not_found", "The CV was not uploaded. Choose the file again.");
    return ok({ cvFileId });
  } catch (error) {
    return fail("internal", describeError(error));
  }
}
