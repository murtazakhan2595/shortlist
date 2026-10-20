import "server-only";
import { requireOwner } from "@/server/auth/require-owner";
import { DOCUMENT_KINDS, type DocumentKind } from "./schemas";

// Data Access Layer for the profile: the feature's reads, each starting with the owner check.

/** The latest version of one of the owner's documents. */
export type OwnerDocument = { kind: DocumentKind; name: string; content: string; version: number; savedAt: string };

export type OwnerMaterialView = {
  documents: OwnerDocument[];
  cvs: { variant: string; fileName: string }[];
};

/** Everything drafts and form answers are written from: the documents and the current CVs (P1 to P7). */
export async function getOwnerMaterial(): Promise<OwnerMaterialView> {
  const { db } = await requireOwner();
  const [documents, cvs] = await Promise.all([
    db.from("current_documents").select("kind, name, content, version, created_at").order("name"),
    db.from("cv_files").select("variant, file_name").eq("is_current", true).order("variant"),
  ]);
  if (documents.error) throw new Error(`Could not load your documents: ${documents.error.message}`);
  if (cvs.error) throw new Error(`Could not load your CVs: ${cvs.error.message}`);

  return {
    // The view's columns can all be null to the type generator, though the table's never are.
    documents: documents.data.flatMap(({ kind, name, content, version, created_at: savedAt }) => {
      const knownKind = DOCUMENT_KINDS.find((documentKind) => documentKind === kind);
      return knownKind && name && content && version && savedAt ? [{ kind: knownKind, name, content, version, savedAt }] : [];
    }),
    cvs: cvs.data.map((cv) => ({ variant: cv.variant, fileName: cv.file_name })),
  };
}
