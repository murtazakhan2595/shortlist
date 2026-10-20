import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/server/supabase/database.types";

// Saving the owner's documents: profile, answer bank, voice examples and email patterns (Q8).
// Saving never overwrites: a change is stored as a new version, so every draft can point to what it used.

export type DocumentToSave = Pick<Tables<"documents">, "kind" | "name" | "content">;

export type SavedDocument = { status: "added" | "updated" | "unchanged"; documentId: string; version: number };

/**
 * Saves the document as a new version unless its latest version already has the same content.
 * Takes the owner's client in the app and the admin client in scripts.
 */
export async function saveDocumentIfChanged(db: SupabaseClient<Database>, document: DocumentToSave): Promise<SavedDocument> {
  const { data: current, error: readError } = await db
    .from("current_documents")
    .select("id, version, content")
    .eq("kind", document.kind)
    .eq("name", document.name)
    .maybeSingle();
  if (readError) throw new Error(`Could not read ${document.kind}/${document.name}: ${readError.message}`);

  if (current?.id && current.version && current.content === document.content) {
    return { status: "unchanged", documentId: current.id, version: current.version };
  }

  // Two saves at once would pick the same version; the unique (kind, name, version) rule stops the second.
  const version = (current?.version ?? 0) + 1;
  const { data, error } = await db.from("documents").insert({ ...document, version }).select("id").single();
  if (error) throw new Error(`Could not save ${document.kind}/${document.name}: ${error.message}`);

  return { status: current ? "updated" : "added", documentId: data.id, version };
}

// ---------------------------------------------------------------------------
// Answers the owner gives on forms, kept in the answer bank for the next form that asks (F5)
// ---------------------------------------------------------------------------

const ANSWER_BANK = { kind: "answer_bank", name: "main" } as const;
const FORM_ANSWERS_HEADING = "## Answers given on forms";
const FORM_ANSWERS_INTRO = "The owner's own answers to form questions, saved from the app.";

/** Adds the owner's answer to the answer bank as a new version, and returns that version. */
export async function addToAnswerBank(db: SupabaseClient<Database>, question: string, answer: string): Promise<number> {
  const { data, error } = await db
    .from("current_documents")
    .select("content")
    .eq("kind", ANSWER_BANK.kind)
    .eq("name", ANSWER_BANK.name)
    .maybeSingle();
  if (error) throw new Error(`Could not read the answer bank: ${error.message}`);
  if (!data?.content) throw new Error("There is no answer bank to add to");

  const saved = await saveDocumentIfChanged(db, { ...ANSWER_BANK, content: withFormAnswer(data.content, question, answer) });
  return saved.version;
}

/**
 * The answer bank with this answer in its "Answers given on forms" section, which is added at the end the
 * first time. A question answered before has its old answer replaced, so the bank never holds two.
 */
export function withFormAnswer(answerBank: string, question: string, answer: string): string {
  const questionLine = `- Question: ${oneLine(question)}`;
  const entry = `${questionLine}\n  Answer: ${oneLine(answer)}`;

  const headingAt = answerBank.indexOf(FORM_ANSWERS_HEADING);
  if (headingAt === -1) return `${answerBank.trimEnd()}\n\n${FORM_ANSWERS_HEADING}\n\n${FORM_ANSWERS_INTRO}\n\n${entry}\n`;

  // The section runs to the next heading of the same level, or to the end.
  const bodyAt = headingAt + FORM_ANSWERS_HEADING.length;
  const nextHeadingAt = answerBank.indexOf("\n## ", bodyAt);
  const sectionEnd = nextHeadingAt === -1 ? answerBank.length : nextHeadingAt;

  const lines = answerBank.slice(bodyAt, sectionEnd).trimEnd().split("\n");
  const earlier = lines.indexOf(questionLine);
  if (earlier !== -1) lines.splice(earlier, 2);

  return `${answerBank.slice(0, bodyAt)}${lines.join("\n")}\n${entry}\n${answerBank.slice(sectionEnd)}`;
}

function oneLine(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, " ");
}
