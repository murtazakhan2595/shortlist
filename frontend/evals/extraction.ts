import { z } from "zod";
import { type ExtractedPost, type PostInput, readPost } from "@/features/captures/steps/extract-capture";
import { imageContentType } from "@/lib/uploads";
import { readPrivateFile } from "./cases";
import type { EvalCheck, Grade } from "./check";

// Check E1, extraction from captured posts (REQUIREMENTS.md section 7), in two parts because the
// pass bars differ: the email must be exactly right on every pasted-text post, and on 95% of screenshots.
// A case is a saved post (a path relative to private/) and what a careful reader takes from it.

const ExpectedSchema = z.object({
  role: z.string().nullable(),
  company: z.string().nullable(),
  posterName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  formUrl: z.string().nullable(),
});

const TextCaseSchema = z.object({ file: z.string().endsWith(".txt"), expected: ExpectedSchema });
type TextCase = z.infer<typeof TextCaseSchema>;

const ScreenshotCaseSchema = z.object({ files: z.array(z.string()).min(1), expected: ExpectedSchema });
type ScreenshotCase = z.infer<typeof ScreenshotCaseSchema>;

function screenshotsPost(files: string[]): PostInput {
  const images = files.map((file) => {
    const mimeType = imageContentType(file);
    if (!mimeType) throw new Error(`Unexpected image type: ${file}`);
    return { mimeType, base64: readPrivateFile(file).toString("base64") };
  });
  return { kind: "screenshots", images };
}

/**
 * Passes when the email and the form link are exactly right, as they decide where an application goes.
 * Role, company and poster name are shown in the reason but do not fail a case: E1's bar is on the email.
 */
export function gradeExtraction(output: ExtractedPost, expected: z.infer<typeof ExpectedSchema>): Grade {
  const same = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

  const wrong = (["contactEmail", "formUrl"] as const).filter((field) => !same(output[field], expected[field]));
  const differs = (["role", "company", "posterName"] as const).filter((field) => !same(output[field], expected[field]));

  const describe = (fields: readonly (keyof typeof expected)[]) =>
    fields.map((field) => `${field}: got ${JSON.stringify(output[field])}, expected ${JSON.stringify(expected[field])}`);

  if (wrong.length > 0) return { pass: false, reason: [...describe(wrong), ...describe(differs)].join("; ") };
  return { pass: true, reason: differs.length > 0 ? `also differs: ${describe(differs).join("; ")}` : "" };
}

export const E1_TEXT: EvalCheck<TextCase, ExtractedPost> = {
  id: "E1-text",
  name: "Extraction from pasted posts",
  passBar: 1,
  caseSchema: TextCaseSchema,
  run(testCase, model, link) {
    return readPost({ kind: "text", text: readPrivateFile(testCase.file).toString("utf8") }, { model, link });
  },
  grade(output, testCase) {
    return gradeExtraction(output, testCase.expected);
  },
};

export const E1_SCREENSHOT: EvalCheck<ScreenshotCase, ExtractedPost> = {
  id: "E1-screenshot",
  name: "Extraction from screenshots, before confirmation",
  passBar: 0.95,
  caseSchema: ScreenshotCaseSchema,
  run(testCase, model, link) {
    return readPost(screenshotsPost(testCase.files), { model, link });
  },
  grade(output, testCase) {
    return gradeExtraction(output, testCase.expected);
  },
};
