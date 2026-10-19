// Ported from: https://github.com/MadsLorentzen/ai-job-search/blob/5d9e0977f01465166f25abf0826bd61e7c8cac25/tools/job_key.py (MIT)
//
// The duplicate key for a job: the same job always gets the same key, and two different jobs never
// share one (D2, X6). It is stored as the unique fingerprint of an application or listing.
// Ported: make_key and its rules (ASCII slug, length cap with a hash of the full slug, a hash for
// names written in a non-Latin script). Left out: the audit of an existing state file.

import "server-only";
import { createHash } from "node:crypto";

const COMPANY_MAX = 40;
const TITLE_MAX = 60;
const HASH_LENGTH = 6;

const NON_SLUG = /[^a-z0-9]+/g;
const JOB_ID = /(\d{6,})/;
const LETTER = /\p{L}/u;
const LATIN = /\p{Script=Latin}/u;

/** "Full-Stack Engineer (Remote)" -> "full-stack-engineer-remote". Non-Latin scripts reduce to "". */
export function slugify(text: string): string {
  const asciiOnly = text.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  return asciiOnly.toLowerCase().replace(NON_SLUG, "-").replace(/^-+|-+$/g, "");
}

function sha1(text: string): string {
  return createHash("sha1").update(text, "utf8").digest("hex").slice(0, HASH_LENGTH);
}

/**
 * True when making the slug dropped letters from a non-Latin script, so the slug alone no longer
 * identifies the name: "Сбер AI" and "Яндекс AI" both reduce to "ai". Latin letters without an ASCII
 * form ("ø", "ß") are not counted, as in the original.
 */
function lostLetters(text: string): boolean {
  return [...text.normalize("NFKD")].some((char) => LETTER.test(char) && !LATIN.test(char));
}

/** Caps the length, adding a hash of the full slug so a long name always gets the same key. */
function cap(slug: string, limit: number): string {
  if (slug.length <= limit) return slug;
  return `${slug.slice(0, limit).replace(/-+$/, "")}-${sha1(slug)}`;
}

function companyPart(company: string): string {
  const slug = cap(slugify(company), COMPANY_MAX);
  if (slug && !lostLetters(company)) return slug;

  const name = company.trim().toLowerCase().normalize("NFC");
  if (!name) return "unknown-company";
  return slug ? `${slug}-${sha1(name)}` : `company-${sha1(name)}`;
}

function titlePart(title: string, url: string): string {
  const slug = cap(slugify(title), TITLE_MAX);
  if (slug && !lostLetters(title)) return slug;

  // The listing's own numeric id is the stable handle; a surviving fragment stays as a readable prefix.
  const jobId = url.match(JOB_ID)?.[1];
  if (jobId) return slug ? `${slug}-${jobId}` : jobId;

  // Otherwise the URL identifies the listing better than the title does; with no URL, the title it is.
  const digest = sha1(url || title);
  if (slug) return `${slug}-${digest}`;
  return slugify(title || url) || `untitled-${digest}`;
}

/** The duplicate key for one job: "<company-slug>_<title-slug>". */
export function jobKey(company: string, title: string, url = ""): string {
  return `${companyPart(company)}_${titlePart(title, url)}`;
}
