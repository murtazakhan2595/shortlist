import { BANNED_PATTERNS, BANNED_PHRASES } from "./banned-phrases";
import { TECH_TERMS } from "./tech-terms";

// The checks code makes on a draft before a model reviews it (PLAN.md item 2.2; X4).
// Idea from career-ops verify-cv-facts.mjs: every number and technology in a draft must already
// appear in the sources. These are exact text checks, so they cannot be argued with or talked round.

export type EmailDraft = {
  cvVariant: string;
  presentedTitle: string;
  emailPattern: string;
  subject: string;
  /** From the greeting to the last line before the sign-off. */
  body: string;
  /** The sign-off and signature block. */
  signature: string;
};

export type DraftSources = {
  profile: string;
  answerBank: string;
  postText: string;
  /** The role as the post names it, which a draft may repeat even when it names a technology. */
  postRole: string | null;
  /** The chosen pattern's text, which states its length as "**Length:** 60–120 words". */
  patternContent: string;
};

const NUMBER = /\d+(?:[.,]\d+)*/g;
const LINK = /\bhttps?:\/\/[^\s)>\]]+|\b(?:[a-z0-9-]+\.)+(?:com|io|dev|me|pk|org|net|app)\/[^\s)>\]]*/gi;
const LENGTH_RULE = /\*\*Length:\*\*\s*(\d+)\s*[–-]\s*(\d+)\s*words/;
const MAX_SUBJECT_LENGTH = 120;

/** Every problem code can find, in words the writer can act on. Empty when the draft passes. */
export function findDraftProblems(draft: EmailDraft, sources: DraftSources): string[] {
  const text = `${draft.subject}\n${draft.body}\n${draft.signature}`;
  const aboutOwner = normalise(`${sources.profile}\n${sources.answerBank}`);
  const everything = normalise(`${aboutOwner}\n${sources.postText}`);

  return [
    ...lengthProblems(draft, sources.patternContent),
    ...bannedPhraseProblems(text),
    ...unsupportedNumbers(text, everything),
    ...unsupportedLinks(text, everything),
    // A technology from the post is allowed only as part of the role's own name ("your Vue Developer role");
    // the model check catches a claim made around it.
    ...unsupportedTechnologies(`${draft.body}\n${draft.signature}`, `${aboutOwner}\n${normalise(sources.postRole ?? "")}`),
  ];
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function lengthProblems(draft: EmailDraft, patternContent: string): string[] {
  const problems: string[] = [];
  if (!draft.subject.trim()) problems.push("The subject line is empty.");
  if (draft.subject.length > MAX_SUBJECT_LENGTH) problems.push(`The subject line is over ${MAX_SUBJECT_LENGTH} characters.`);

  const rule = patternContent.match(LENGTH_RULE);
  if (rule) {
    const [min, max] = [Number(rule[1]), Number(rule[2])];
    const words = countWords(draft.body);
    if (words < min || words > max) {
      problems.push(`The body has ${words} words; the ${draft.emailPattern} pattern needs ${min} to ${max}.`);
    }
  }
  return problems;
}

function bannedPhraseProblems(text: string): string[] {
  const phrases = BANNED_PHRASES.filter((phrase) => new RegExp(`\\b${escapeRegExp(phrase)}`, "i").test(text));
  const patterns = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text));
  return [
    ...phrases.map((phrase) => `Remove the banned phrase "${phrase}".`),
    ...patterns.map(({ description }) => `Remove ${description}.`),
  ];
}

function unsupportedNumbers(text: string, sources: string): string[] {
  const numbers = new Set([...text.matchAll(NUMBER)].map(([number]) => number.replace(/,/g, "")));
  return [...numbers]
    .filter((number) => !containsWhole(sources, number))
    .map((number) => `The number ${number} does not appear in the profile, the answer bank or the post.`);
}

function unsupportedLinks(text: string, sources: string): string[] {
  const links = new Set([...text.matchAll(LINK)].map(([link]) => stripLinkStart(link).replace(/[.,;:]+$/, "")));
  return [...links]
    .filter((link) => !sources.includes(link.toLowerCase()))
    .map((link) => `The link ${link} does not appear in the profile, the answer bank or the post.`);
}

function unsupportedTechnologies(text: string, sources: string): string[] {
  return TECH_TERMS.filter((term) => containsTerm(text, term, "") && !containsTerm(sources, term, "i")).map(
    (term) => `"${term}" is not in the profile or the answer bank, so the draft cannot claim it.`,
  );
}

/** Lowercase, with commas inside numbers removed, so "2,500" in a draft matches "2500" in a source. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/(\d),(?=\d)/g, "$1");
}

/** The number as a whole, so 5 is not found inside 50 or 2025. */
function containsWhole(text: string, number: string): boolean {
  return new RegExp(`(^|[^\\d.])${escapeRegExp(number)}(?![\\d]|\\.\\d)`).test(text);
}

/**
 * A term as a whole word, so "Java" is not found inside "JavaScript" or "SQL" inside "PostgreSQL".
 * Drafts are matched with the term's own capitals ("" flags); sources ignore case ("i").
 */
function containsTerm(text: string, term: string, flags: "" | "i"): boolean {
  return new RegExp(`(^|[^A-Za-z0-9.#+])${escapeRegExp(term)}(?![A-Za-z0-9#+]|\\.[A-Za-z])`, flags).test(text);
}

function stripLinkStart(link: string): string {
  return link.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
