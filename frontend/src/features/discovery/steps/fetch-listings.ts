import "server-only";
import { HIMALAYAS_SOURCE, type HimalayasJob } from "@/server/himalayas";
import { jobKey } from "@/server/job-key";
import { getAdminClient } from "@/server/supabase/admin";
import type { Eligibility, Listing } from "../schemas";

// The daily run's first step (PLAN.md items 4.1 and 4.2): new jobs are fetched, converted to one format,
// and saved once each; expired ones are deleted.

// ---------------------------------------------------------------------------
// One format for every source (D2)
// ---------------------------------------------------------------------------

const SALARY_PERIODS: Record<string, Listing["salary_period"]> = { hourly: "hour", monthly: "month", annual: "year" };

/** A Himalayas job in the common format. */
export function himalayasListing(job: HimalayasJob, runId: string): Listing {
  const tags = ["remote"]; // Himalayas lists remote jobs only (D6).
  if (job.employmentType === "Contractor") tags.push("contractor");

  return {
    source: HIMALAYAS_SOURCE,
    source_id: job.guid,
    url: job.applicationLink,
    title: job.title.trim(),
    company: job.companyName.trim(),
    location: job.locationRestrictions.length > 0 ? job.locationRestrictions.join(", ") : "Worldwide",
    countries: job.locationRestrictions,
    salary_min: job.minSalary ?? null,
    salary_max: job.maxSalary ?? null,
    salary_currency: job.currency ?? null,
    salary_period: SALARY_PERIODS[job.salaryPeriod ?? ""] ?? null,
    seniority: job.seniority,
    employment_type: job.employmentType ?? null,
    categories: job.parentCategories,
    tags,
    description: htmlToText(job.description),
    // The same job from two sources gets the same key, so it is stored once (D2, X6).
    fingerprint: jobKey(job.companyName, job.title),
    posted_at: new Date(job.pubDate * 1000).toISOString(),
    expires_at: job.expiryDate ? new Date(job.expiryDate * 1000).toISOString() : null,
    run_id: runId,
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** A job description's HTML as plain text, which is shorter and easier for a model to read. */
export function htmlToText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Saving and removing
// ---------------------------------------------------------------------------

/**
 * Saves the listings that are new and returns their ids (D2, X6). The database skips a listing the same
 * source gave before, the same job from another source, and a job the owner already captured or answered a
 * form for (save_new_listings). So running this twice saves nothing the second time.
 */
export async function saveNewListings(listings: (Listing & Eligibility)[]): Promise<string[]> {
  if (listings.length === 0) return [];
  const { data, error } = await getAdminClient().rpc("save_new_listings", { new_listings: listings });
  if (error) throw new Error(`Could not save the listings: ${error.message}`);
  return data;
}

/** Deletes expired listings, as Himalayas' terms ask, and returns how many (delete_expired_listings). */
export async function deleteExpiredListings(): Promise<number> {
  const { data, error } = await getAdminClient().rpc("delete_expired_listings");
  if (error) throw new Error(`Could not delete expired listings: ${error.message}`);
  return data;
}
