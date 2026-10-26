// Exact text checks run before the model check, so they cannot be argued with.
// The number check is an idea from career-ops verify-cv-facts.mjs. The banned phrases are
// Ported from: https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/skills/job-application-assistant/03-writing-style.md (MIT)
// plus our own additions.

import { escapeRegExp } from "@/lib/regex";
import type { EmailDraft, WriterContext } from "../schemas";

/** Matched anywhere, ignoring case, from the start of a word. */
const BANNED_PHRASES = [
  // Openers and closers
  "I hope this email finds you well", "I hope you are doing well", "I am writing to express my interest",
  "Please find attached", "for your kind consideration", "Respected Sir", "Dear Sir/Madam", "To whom it may concern",
  "I look forward to the opportunity to", "Thank you for your time and consideration", "I would be thrilled",
  "I am excited to apply",
  // Self-description without proof
  "passionate about", "driven by a passion for", "proven track record", "results-driven", "detail-oriented",
  "self-starter", "team player", "hit the ground running", "I believe I would be a great fit", "perfect fit",
  "go-getter", "rockstar", "ninja",
  // Inflated verbs and stock words
  "leverage", "spearheaded", "orchestrated", "synergy", "synergies", "drive results", "facilitate", "utilize",
  "endeavor", "delve", "crucial", "underscores", "cutting-edge", "state-of-the-art", "seamless", "robust",
  "dynamic", "fast-paced", "innovative solutions", "game-changer", "transformative", "unlock", "elevate", "harness",
  // Hedges
  "I think I could", "I feel that", "just checking in", "sorry to bother you",
];

const BANNED_PATTERNS = [
  { pattern: /(^|[.!?]\s+)(Additionally|Furthermore|Moreover),/m, description: 'a sentence opening with "Additionally", "Furthermore" or "Moreover"' },
  { pattern: /\bin today's .{0,40}landscape\b/i, description: `"In today's ... landscape"` },
  { pattern: /—/, description: "an em dash (use a comma, period or colon)" },
];

// Matched case-sensitively in drafts ("Express", not "express") so ordinary words are not taken for tools;
// "Go" is left out for that reason.
const TECH_TERMS = [
  "TypeScript", "JavaScript", "Python", "Java", "Kotlin", "Swift", "Golang", "Rust", "C#", "C++", "Ruby", "PHP",
  "Scala", "Elixir", "Dart", "SQL", "React", "React Native", "Next.js", "Vue", "Nuxt", "Angular", "Svelte",
  "Redux", "Tailwind", "Flutter", "Expo", "Remix", "Astro", "jQuery", "Node.js", "NestJS", "Express", "Fastify",
  "Django", "Flask", "FastAPI", "Spring", "Laravel", "Rails", ".NET", "GraphQL", "gRPC", "tRPC", "Prisma",
  "Drizzle", "TypeORM", "Sequelize", "PostgreSQL", "Postgres", "MySQL", "MongoDB", "Redis", "DynamoDB",
  "Elasticsearch", "Cassandra", "SQLite", "Supabase", "Firebase", "Kafka", "RabbitMQ", "SQS", "BigQuery",
  "Snowflake", "AWS", "Azure", "GCP", "Google Cloud", "Lambda", "Docker", "Kubernetes", "Terraform", "Vercel",
  "Netlify", "GitHub Actions", "Jenkins", "CircleCI", "Ansible", "LangChain", "LangGraph", "LlamaIndex", "CrewAI",
  "OpenAI", "Hugging Face", "PyTorch", "TensorFlow", "scikit-learn", "Pandas", "RAG", "pgvector", "Pinecone",
  "Weaviate", "Qdrant", "Chroma", "MCP", "Jest", "Vitest", "Playwright", "Cypress", "Selenium",
];

const NUMBER = /\d+(?:[.,]\d+)*/g;
const LINK = /\bhttps?:\/\/[^\s)>\]]+|\b(?:[a-z0-9-]+\.)+(?:com|io|dev|me|pk|org|net|app)\/[^\s)>\]]*/gi;
const LENGTH_RULE = /\*\*Length:\*\*\s*(\d+)\s*[–-]\s*(\d+)\s*words/;
const MAX_SUBJECT_LENGTH = 120;

/** Problems are worded so the writer can act on them. */
export function findDraftProblems(draft: EmailDraft, writer: WriterContext): string[] {
  const text = `${draft.subject}\n${draft.body}\n${draft.signature}`;
  const aboutOwner = normalise(`${writer.profile}\n${writer.answerBank}`);
  const everything = `${aboutOwner}\n${normalise(writer.post.text)}`;
  // In the body, a number or technology from the post is allowed only inside the role, company or poster
  // name ("Engineer 2", "10Pearls"); elsewhere it reads as a claim ("5 years"). The subject may quote the post.
  const claimSources = `${aboutOwner}\n${normalise(writer.post.role ?? "")}`;
  const numberSources = `${claimSources}\n${normalise(`${writer.post.company ?? ""}\n${writer.post.posterName ?? ""}`)}`;
  const bodyText = `${draft.body}\n${draft.signature}`;
  const bodyNumbers = numbersMissingFrom(bodyText, numberSources);
  const subjectNumbers = numbersMissingFrom(draft.subject, everything).filter((number) => !bodyNumbers.includes(number));
  const pattern = writer.patterns.find((candidate) => candidate.name === draft.emailPattern);

  return [
    ...lengthProblems(draft, pattern?.content ?? ""),
    ...BANNED_PHRASES.filter((phrase) => new RegExp(`\\b${escapeRegExp(phrase)}`, "i").test(text)).map(
      (phrase) => `Remove the banned phrase "${phrase}".`,
    ),
    ...BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ description }) => `Remove ${description}.`),
    ...bodyNumbers.map((number) => `The number ${number} does not appear in the profile or the answer bank.`),
    ...subjectNumbers.map((number) => `The number ${number} in the subject does not appear in the profile, the answer bank or the post.`),
    ...unique(text.matchAll(LINK), (link) => link.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[.,;:]+$/, ""))
      .filter((link) => !everything.includes(link.toLowerCase()))
      .map((link) => `The link ${link} does not appear in the profile, the answer bank or the post.`),
    ...TECH_TERMS.filter((term) => containsTerm(bodyText, term, "") && !containsTerm(claimSources, term, "i")).map(
      (term) => `"${term}" is not in the profile or the answer bank, so the draft cannot claim it.`,
    ),
  ];
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function lengthProblems(draft: EmailDraft, patternContent: string): string[] {
  const problems: string[] = [];
  if (!draft.subject.trim()) problems.push("The subject line is empty.");
  if (draft.subject.length > MAX_SUBJECT_LENGTH) problems.push(`The subject line is over ${MAX_SUBJECT_LENGTH} characters.`);

  // Read from the pattern text ("**Length:** 60–120 words"), so editing a pattern changes the check.
  const rule = patternContent.match(LENGTH_RULE);
  const words = countWords(draft.body);
  if (rule && (words < Number(rule[1]) || words > Number(rule[2]))) {
    problems.push(`The body has ${words} words; the ${draft.emailPattern} pattern needs ${rule[1]} to ${rule[2]}.`);
  }
  return problems;
}

function numbersMissingFrom(text: string, sources: string): string[] {
  return unique(text.matchAll(NUMBER), (number) => number.replace(/,/g, "")).filter((number) => !containsWhole(sources, number));
}

function unique(matches: Iterable<RegExpMatchArray>, clean: (match: string) => string): string[] {
  return [...new Set([...matches].map(([match]) => clean(match)))];
}

/** So "2,500" in a draft matches "2500" in a source. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/(\d),(?=\d)/g, "$1");
}

/** So 5 is not found inside 50 or 2025. */
function containsWhole(text: string, number: string): boolean {
  return new RegExp(`(^|[^\\d.])${escapeRegExp(number)}(?![\\d]|\\.\\d)`).test(text);
}

/** Whole word, so "Java" is not found inside "JavaScript". Drafts match case (""); sources ignore it ("i"). */
function containsTerm(text: string, term: string, flags: "" | "i"): boolean {
  return new RegExp(`(^|[^A-Za-z0-9.#+])${escapeRegExp(term)}(?![A-Za-z0-9#+]|\\.[A-Za-z])`, flags).test(text);
}
