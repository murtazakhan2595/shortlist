import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { buildWriterGraph, START_STATE, type WriterStateValues, writerOutcome } from "@/features/applications/steps/writer";
import { loadOwnerMaterial } from "@/features/applications/steps/writer-steps";
import { casesDirectory, readPrivateFile } from "./cases";
import type { EvalCheck, Grade } from "./check";

// Checks E3 and E4 (REQUIREMENTS.md section 7) on the writer, run as one: each case is a saved post,
// written by the real writer loop with the owner's real material.
//   E4, graded here: the draft is ready (not blocked), names the role, and attaches the expected CV.
//      The recipient is set by code from the capture, so it cannot be wrong; the test suite covers it.
//   E3, graded by the owner: every draft is written to private/evals/E3/drafts/ to be read for
//      unsupported claims, as the requirements ask for a check by hand.

const WriterCaseSchema = z.object({
  file: z.string().endsWith(".txt"),
  expected: z.object({ contactEmail: z.email(), role: z.string(), cvVariant: z.string() }),
});
type WriterCase = z.infer<typeof WriterCaseSchema>;

const DRAFTS_DIRECTORY = path.join(casesDirectory("E3"), "..", "drafts");

export function gradeDraft(state: WriterStateValues, expected: WriterCase["expected"]): Grade {
  if (writerOutcome(state) === "blocked" || !state.draft) {
    return { pass: false, reason: `blocked: ${state.problems.join(" | ")}` };
  }
  const { draft } = state;
  const wrong: string[] = [];
  if (!`${draft.subject}\n${draft.body}`.toLowerCase().includes(expected.role.toLowerCase())) {
    wrong.push(`role "${expected.role}" not named`);
  }
  if (draft.cvVariant !== expected.cvVariant) wrong.push(`CV ${draft.cvVariant}, expected ${expected.cvVariant}`);
  return { pass: wrong.length === 0, reason: wrong.join("; ") };
}

function saveForReview(caseFile: string, state: WriterStateValues): void {
  mkdirSync(DRAFTS_DIRECTORY, { recursive: true });
  const name = path.basename(path.dirname(caseFile));
  const { draft } = state;
  const text = draft
    ? `Outcome: ${writerOutcome(state)} after ${state.drafts} draft(s)\nCV: ${draft.cvVariant}\nPattern: ${draft.emailPattern}\nPresented as: ${draft.presentedTitle}\nSubject: ${draft.subject}\n\n${draft.body}\n\n${draft.signature}\n\nProblems left: ${state.problems.join(" | ") || "none"}\n`
    : "No draft was written.\n";
  writeFileSync(path.join(DRAFTS_DIRECTORY, `${name}.md`), text);
}

export const E4_WRITER: EvalCheck<WriterCase, WriterStateValues> = {
  id: "E4",
  name: "Draft correctness (drafts saved for the E3 check by hand)",
  passBar: 1,
  caseSchema: WriterCaseSchema,
  async run(testCase, model, link) {
    const material = await loadOwnerMaterial();
    const writer = {
      ...material,
      link,
      post: {
        text: readPrivateFile(testCase.file).toString("utf8"),
        role: testCase.expected.role,
        company: null,
        posterName: null,
        seenOn: "LinkedIn",
      },
      recipientEmail: testCase.expected.contactEmail,
    };
    // The whole loop in one go, in memory: evals have no time limit and keep no state.
    const state = await buildWriterGraph(new MemorySaver()).invoke(START_STATE, {
      configurable: { thread_id: testCase.file },
      context: { writer, models: { write: model } },
    });
    saveForReview(testCase.file, state);
    return state;
  },
  grade(state, testCase) {
    return gradeDraft(state, testCase.expected);
  },
};
