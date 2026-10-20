import "server-only";
import { getAdminClient } from "@/server/supabase/admin";

// The owner's material that drafts and form answers are written from (P1 to P7). Loaded at every step
// rather than kept in saved state, so state stays small and each step uses the latest version.

export type OwnerMaterial = {
  /** Every profile document, each under its name as a heading. */
  profile: string;
  answerBank: string;
  writingGuide: string;
  voiceExamples: string[];
  emailPatterns: { id: string; name: string; content: string }[];
  /** The CV variants with a current file, to choose from (P2). */
  cvVariants: string[];
};

// The answer bank is one document, and the email patterns file's general advice is stored as one more pattern.
const ANSWER_BANK_NAME = "main";
const WRITING_GUIDE_NAME = "writing-guide";

export async function loadOwnerMaterial(): Promise<OwnerMaterial> {
  const db = getAdminClient();
  const [documents, cvFiles] = await Promise.all([
    db.from("current_documents").select("id, kind, name, content").order("name"),
    db.from("cv_files").select("variant").eq("is_current", true).order("variant"),
  ]);
  if (documents.error) throw new Error(`Could not load the owner's documents: ${documents.error.message}`);
  if (cvFiles.error) throw new Error(`Could not load the CV list: ${cvFiles.error.message}`);

  const ofKind = (kind: string) =>
    documents.data.flatMap(({ id, kind: documentKind, name, content }) =>
      documentKind === kind && id && name && content ? [{ id, name, content }] : [],
    );
  const answerBank = ofKind("answer_bank").find((document) => document.name === ANSWER_BANK_NAME)?.content;
  const writingGuide = ofKind("email_pattern").find((document) => document.name === WRITING_GUIDE_NAME)?.content;
  const profile = ofKind("profile").map((document) => `## ${document.name}\n\n${document.content}`);

  if (profile.length === 0 || !answerBank || !writingGuide || cvFiles.data.length === 0) {
    throw new Error("The owner's material is incomplete: run pnpm profile:load");
  }
  return {
    profile: profile.join("\n\n"),
    answerBank,
    writingGuide,
    voiceExamples: ofKind("voice_example").map((document) => document.content),
    emailPatterns: ofKind("email_pattern").filter((document) => document.name !== WRITING_GUIDE_NAME),
    cvVariants: cvFiles.data.map((file) => file.variant),
  };
}
