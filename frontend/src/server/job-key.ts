import "server-only";
import { createHash } from "node:crypto";

// Ported from: https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/tools/job_key.py (MIT)
// Taken: the ASCII slug and the hashed length cap. Left out: keys for non-Latin names and the listing-id fallback.

const FIRST_PART_MAX = 40;
const SECOND_PART_MAX = 60;

export function slugify(text: string): string {
  const asciiOnly = text.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  return asciiOnly.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The hash of the full slug means two long names that start alike never share a key.
function cap(slug: string, limit: number): string {
  if (slug.length <= limit) return slug;
  const hash = createHash("sha1").update(slug).digest("hex").slice(0, 6);
  return `${slug.slice(0, limit).replace(/-+$/, "")}-${hash}`;
}

/** Captures pass the contact email as the company. */
export function jobKey(company: string, title: string): string {
  return `${cap(slugify(company), FIRST_PART_MAX) || "unknown"}_${cap(slugify(title), SECOND_PART_MAX) || "untitled"}`;
}
