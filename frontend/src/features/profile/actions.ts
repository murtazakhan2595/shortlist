"use server";

import { describeError } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import { saveDocumentIfChanged } from "@/server/documents";
import { type DocumentSaved, type SaveDocumentInput, SaveDocumentInputSchema } from "./schemas";

// Server Actions for the owner's material (contracts in ./schemas.ts). Writes use the owner's client, so
// the access rules apply too.

/** Saves an edited document as a new version; the old version is kept (P6, Q8). */
export async function saveDocument(request: SaveDocumentInput): Promise<Result<DocumentSaved>> {
  const input = SaveDocumentInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  try {
    const { documentId, version } = await saveDocumentIfChanged(db, input.data);
    return ok({ documentId, version });
  } catch (error) {
    return fail("internal", describeError(error));
  }
}
