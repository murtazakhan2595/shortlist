import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { findCvSources, readProfileDocuments, splitEmailPatterns } from "./profile-sources";

const EMAIL_PATTERNS = `# Email patterns

## 1. Findings

Short emails get replies.

## 2. Patterns

Three patterns and a note.

### Pattern A: "Post reply" (local recruiter post)

Body of A.

### Short note: "Job-board note" (apply-link listings)

Body of the note.

## 3. Follow-up rule

One follow-up after a week.
`;

function privateFolder(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "private-"));
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), content);
  };
  write("profile-draft.md", "# Profile\n");
  write("courses.md", "# Courses\n");
  write("recommendations.md", "# Recommendations\n");
  write("answer-bank.md", "# Answers\n");
  write("email-patterns.md", EMAIL_PATTERNS);
  write("voice-examples/01-scope.txt", "Hi Ken,\n");
  write("voice-examples/README.md", "Notes, not an example.");
  for (const version of ["Full-Stack", "AI-Engineer", "AI-Full-Stack", "Engineering-Delivery-Manager"]) {
    write(`cvs/out/Owner-CV-${version}.pdf`, "%PDF");
    write(`cvs/out/Owner-CV-${version}-Letter.pdf`, "%PDF");
  }
  return directory;
}

test("splits each email pattern into its own document, named after its quoted phrase", () => {
  const documents = splitEmailPatterns(EMAIL_PATTERNS);

  expect(documents.map((document) => document.name)).toEqual(["post-reply", "job-board-note", "writing-guide"]);
  expect(documents[0].content).toBe('### Pattern A: "Post reply" (local recruiter post)\n\nBody of A.');
});

test("keeps everything outside the patterns in the writing guide", () => {
  const guide = splitEmailPatterns(EMAIL_PATTERNS).at(-1)?.content;

  expect(guide).toContain("Short emails get replies.");
  expect(guide).toContain("Three patterns and a note.");
  expect(guide).toContain("One follow-up after a week.");
  expect(guide).not.toContain("Body of A.");
});

test("reads the profile, answer bank, voice examples and email patterns", () => {
  const documents = readProfileDocuments(privateFolder());

  expect(documents.map(({ kind, name }) => `${kind}/${name}`)).toEqual([
    "profile/main",
    "profile/courses",
    "profile/recommendations",
    "answer_bank/main",
    "voice_example/01-scope",
    "email_pattern/post-reply",
    "email_pattern/job-board-note",
    "email_pattern/writing-guide",
  ]);
});

test("finds the A4 PDF of each of the three CVs, and leaves the delivery manager CV out", () => {
  const cvs = findCvSources(privateFolder());

  expect(cvs.map(({ variant, fileName }) => `${variant}: ${fileName}`)).toEqual([
    "full_stack: Owner-CV-Full-Stack.pdf",
    "ai_engineer: Owner-CV-AI-Engineer.pdf",
    "ai_full_stack: Owner-CV-AI-Full-Stack.pdf",
  ]);
});
