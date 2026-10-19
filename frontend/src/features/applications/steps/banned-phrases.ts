// Ported from: https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/.claude/skills/job-application-assistant/03-writing-style.md (MIT)
//
// Phrases a draft must not contain (REQUIREMENTS.md P7; the owner's writing rules, private/email-patterns.md
// section 4). The list combines ai-job-search's style rules with the owner's research; any match sends the
// draft back to be rewritten.

/** Matched anywhere, ignoring case. */
export const BANNED_PHRASES = [
  // Openers and closers
  "I hope this email finds you well",
  "I hope you are doing well",
  "I am writing to express my interest",
  "Please find attached",
  "for your kind consideration",
  "Respected Sir",
  "Dear Sir/Madam",
  "To whom it may concern",
  "I look forward to the opportunity to",
  "Thank you for your time and consideration",
  "I would be thrilled",
  "I am excited to apply",
  // Self-description without proof
  "passionate about",
  "driven by a passion for",
  "proven track record",
  "results-driven",
  "detail-oriented",
  "self-starter",
  "team player",
  "hit the ground running",
  "I believe I would be a great fit",
  "perfect fit",
  "go-getter",
  "rockstar",
  "ninja",
  // Inflated verbs and stock words
  "leverage",
  "spearheaded",
  "orchestrated",
  "synergy",
  "synergies",
  "drive results",
  "facilitate",
  "utilize",
  "endeavor",
  "delve",
  "crucial",
  "underscores",
  "cutting-edge",
  "state-of-the-art",
  "seamless",
  "robust",
  "dynamic",
  "fast-paced",
  "innovative solutions",
  "game-changer",
  "transformative",
  "unlock",
  "elevate",
  "harness",
  // Hedges
  "I think I could",
  "I feel that",
  "just checking in",
  "sorry to bother you",
] as const;

/** Patterns that need more than a plain phrase: filler words that open a sentence, and the em dash. */
export const BANNED_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /(^|[.!?]\s+)(Additionally|Furthermore|Moreover),/m, description: 'a sentence opening with "Additionally", "Furthermore" or "Moreover"' },
  { pattern: /\bin today's .{0,40}landscape\b/i, description: `"In today's ... landscape"` },
  { pattern: /—/, description: "an em dash (use a comma, period or colon)" },
];
