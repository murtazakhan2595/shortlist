import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CV_VARIANTS, type CvVariant, type DocumentKind } from "@/features/profile/schemas";

// Which of the owner's private files are loaded into Supabase, and as what (PLAN.md item 1.7).
// The files stay in the git-ignored private/ folder; only their content goes to the database.

export type ProfileDocument = { kind: DocumentKind; name: string; content: string };
export type CvSource = { variant: CvVariant; fileName: string; filePath: string };

const SINGLE_FILE_DOCUMENTS: { file: string; kind: DocumentKind; name: string }[] = [
  { file: "profile-draft.md", kind: "profile", name: "main" },
  { file: "courses.md", kind: "profile", name: "courses" },
  { file: "recommendations.md", kind: "profile", name: "recommendations" },
  { file: "answer-bank.md", kind: "answer_bank", name: "main" },
];

const VOICE_EXAMPLES_FOLDER = "voice-examples";
const EMAIL_PATTERNS_FILE = "email-patterns.md";
const CV_FOLDER = path.join("cvs", "out");

// The A4 PDF of each CV the app chooses from (P2). The engineering delivery manager CV is kept for
// manual use and not loaded, as the requirements cover three versions.
const CV_FILE_ENDINGS: Record<CvVariant, string> = {
  full_stack: "-CV-Full-Stack.pdf",
  ai_engineer: "-CV-AI-Engineer.pdf",
  ai_full_stack: "-CV-AI-Full-Stack.pdf",
};

const PATTERNS_SECTION_HEADING = /^## 2\. Patterns/m;
const NEXT_SECTION_HEADING = /^## /m;
const PATTERN_HEADING = /^### .*$/gm;
const QUOTED_NAME = /"([^"]+)"/;

function readText(privateDirectory: string, file: string): string {
  const filePath = path.join(privateDirectory, file);
  if (!existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  return readFileSync(filePath, "utf8").trim();
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Each email pattern becomes its own document, so a draft can record which one it used (P7).
 * A pattern is named after the quoted phrase in its heading: `### Pattern A: "Post reply"` -> post-reply.
 * Everything else in the file (findings, voice, follow-up rule, writing rules) becomes the writing guide.
 */
export function splitEmailPatterns(markdown: string): ProfileDocument[] {
  const sectionStart = markdown.search(PATTERNS_SECTION_HEADING);
  if (sectionStart === -1) throw new Error(`${EMAIL_PATTERNS_FILE} has no "## 2. Patterns" section`);

  const afterHeading = markdown.indexOf("\n", sectionStart) + 1;
  const nextSection = markdown.slice(afterHeading).search(NEXT_SECTION_HEADING);
  const sectionEnd = nextSection === -1 ? markdown.length : afterHeading + nextSection;
  const section = markdown.slice(afterHeading, sectionEnd);

  const headings = [...section.matchAll(PATTERN_HEADING)];
  if (headings.length === 0) throw new Error(`${EMAIL_PATTERNS_FILE} lists no patterns`);

  const patterns = headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? section.length;
    const name = slug(heading[0].match(QUOTED_NAME)?.[1] ?? heading[0].replace(/^### /, ""));
    return { kind: "email_pattern" as const, name, content: section.slice(start, end).trim() };
  });

  const firstPattern = afterHeading + headings[0].index;
  const guide = `${markdown.slice(0, firstPattern).trim()}\n\n${markdown.slice(sectionEnd).trim()}`;

  return [...patterns, { kind: "email_pattern", name: "writing-guide", content: guide.trim() }];
}

export function readProfileDocuments(privateDirectory: string): ProfileDocument[] {
  const singleFiles = SINGLE_FILE_DOCUMENTS.map(({ file, kind, name }) => ({
    kind,
    name,
    content: readText(privateDirectory, file),
  }));

  const voiceFolder = path.join(privateDirectory, VOICE_EXAMPLES_FOLDER);
  const voiceExamples = readdirSync(voiceFolder)
    .filter((file) => file.endsWith(".txt"))
    .sort()
    .map((file) => ({
      kind: "voice_example" as const,
      name: path.basename(file, ".txt"),
      content: readText(voiceFolder, file),
    }));
  if (voiceExamples.length === 0) throw new Error(`No voice examples (.txt) in ${voiceFolder}`);

  return [...singleFiles, ...voiceExamples, ...splitEmailPatterns(readText(privateDirectory, EMAIL_PATTERNS_FILE))];
}

export function findCvSources(privateDirectory: string): CvSource[] {
  const folder = path.join(privateDirectory, CV_FOLDER);
  const files = existsSync(folder) ? readdirSync(folder) : [];

  return CV_VARIANTS.map((variant) => {
    const ending = CV_FILE_ENDINGS[variant];
    const fileName = files.find((file) => file.endsWith(ending));
    if (!fileName) throw new Error(`No CV ending in ${ending} in ${folder}`);
    return { variant, fileName, filePath: path.join(folder, fileName) };
  });
}
