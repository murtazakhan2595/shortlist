import "server-only";
import { z } from "zod";
import { fetchHimalayasJobs, HIMALAYAS_SOURCE, type HimalayasJob } from "@/server/himalayas";
import { jobKey } from "@/server/job-key";
import { finishRun } from "@/server/runs";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import type { Eligibility, Listing } from "../schemas";
import { eligibilityOf, loadFilterSettings } from "./eligibility";

// Queue step fetch_listings, the daily run's first step (PLAN.md items 4.1 to 4.3 and 4.5). Queued every
// night by start_daily_run (supabase/migrations/*_daily_run.sql). In one short call it:
//
// 1. fetches the jobs posted since the last run,
// 2. converts them to one format (D2) and decides each one's eligibility before any model call (D3, D4),
// 3. saves the new ones (D2, X6). Excluded listings are saved too, so the filter's choices can be checked,
// 4. deletes expired listings, as Himalayas' terms ask,
// 5. records the run's counts and finishes it.
//
// Safe to run twice: the second run saves nothing new, and the counts are read back from the saved rows.

const FetchListingsPayloadSchema = z.object({ runId: z.uuid() });

// The first run reads back a day. Later runs read back to the last run's start, less a margin for jobs
// published while it ran; a job read twice is saved once.
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const OVERLAP_MS = 60 * 60 * 1000;

export async function fetchListings(payload: Json): Promise<void> {
  const { runId } = FetchListingsPayloadSchema.parse(payload);

  const [since, settings] = await Promise.all([fetchSince(runId), loadFilterSettings()]);
  const jobs = await fetchHimalayasJobs(since);
  const listings = jobs.map((job) => {
    const listing = himalayasListing(job, runId);
    return { ...listing, ...eligibilityOf(listing, settings) };
  });

  await saveNewListings(listings);
  await deleteExpiredListings();
  await recordCounts(runId, jobs.length);
  await finishRun(runId);
}

/** Where this run starts reading: the last finished daily run's start, or a day back for the first run. */
async function fetchSince(runId: string): Promise<Date> {
  const { data, error } = await getAdminClient()
    .from("runs")
    .select("started_at")
    .eq("kind", "daily")
    .eq("status", "succeeded")
    .neq("id", runId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not find the last daily run: ${error.message}`);
  if (!data) return new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);
  return new Date(new Date(data.started_at).getTime() - OVERLAP_MS);
}

/** How many jobs were fetched, and how many new ones were kept for scoring (not excluded). */
async function recordCounts(runId: string, fetched: number): Promise<void> {
  const db = getAdminClient();
  const kept = await db
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .neq("eligibility", "excluded");
  if (kept.error) throw new Error(`Could not count the run's listings: ${kept.error.message}`);

  const saved = await db.from("runs").update({ listings_fetched: fetched, listings_kept: kept.count ?? 0 }).eq("id", runId);
  if (saved.error) throw new Error(`Could not record the run's counts: ${saved.error.message}`);
}

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
