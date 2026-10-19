import "server-only";
import { createHash } from "node:crypto";

// Ported from: https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/tools/job_key.py (MIT)
//
// The duplicate key for a job: the same job always gets the same key (D2, X6). Stored as the unique
// fingerprint of an application. Taken from the original: the ASCII slug, and the length cap that adds
// a hash of the full slug so a long name always gives the same key. Left out until a source needs them:
// its special keys for names in non-Latin scripts, and its fallback to a listing's id.

const FIRST_PART_MAX = 40;
const SECOND_PART_MAX = 60;

/** "Full-Stack Engineer (Remote)" -> "full-stack-engineer-remote". */
export function slugify(text: string): string {
  const asciiOnly = text.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  return asciiOnly.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Caps the length, adding a hash of the full slug, so two long names that start alike never share a key. */
function cap(slug: string, limit: number): string {
  if (slug.length <= limit) return slug;
  const hash = createHash("sha1").update(slug).digest("hex").slice(0, 6);
  return `${slug.slice(0, limit).replace(/-+$/, "")}-${hash}`;
}

/** The duplicate key: "<company-slug>_<title-slug>". Captures pass the contact email as the company. */
export function jobKey(company: string, title: string): string {
  return `${cap(slugify(company), FIRST_PART_MAX) || "unknown"}_${cap(slugify(title), SECOND_PART_MAX) || "untitled"}`;
}
