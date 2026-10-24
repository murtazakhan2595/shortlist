import "server-only";
import { z } from "zod";
import { fetchHackerNewsPosts, HACKER_NEWS_SOURCE, hackerNewsPostUrl, type HackerNewsPost } from "@/server/hacker-news";
import { fetchHimalayasJobs, HIMALAYAS_SOURCE, type HimalayasJob } from "@/server/himalayas";
import { jobKey } from "@/server/job-key";
import { enqueueStep } from "@/server/queue/queue";
import { STEP_NAMES } from "@/server/queue/step-names";
import { finishRun } from "@/server/runs";
import { loadSpendingCap } from "@/server/spending";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import type { Eligibility, Listing } from "../schemas";
import { eligibilityOf, loadFilterSettings, offersVisa, REMOTE } from "./eligibility";
import { queueScoring } from "./score-listings";

// Queue step fetch_listings, the daily run's first steps (PLAN.md items 4.1 to 4.3 and 4.5; sprint 7).
// Queued every night by start_daily_run (supabase/migrations/*_daily_run.sql) for the first source; each
// source's step queues the next one's, so the sources are read one after another, one per short call. Each:
//
// 1. fetches its source's jobs posted since the last run,
// 2. converts them to one format (D2) and decides each one's eligibility before any model call (D3, D4),
// 3. saves the new ones (D2, X6). Excluded listings are saved too, so the filter's choices can be checked,
// 4. queues the next source. After the last one, it deletes expired listings, records the run's counts and
//    queues the kept listings to be scored (score-listings.ts).
//
// A source that fails every attempt is skipped (fetchingGaveUp): the night goes on with the others, and the
// owner sees the failure. Safe to run twice: the second run saves nothing new, the number read travels in
// the payload, and only listings without a score are queued.
//
// Once this month's spending reaches the cap (B2), the run fetches nothing: nothing could be scored.

/** The sources, in the order a night reads them. */
const SOURCES = [HIMALAYAS_SOURCE, HACKER_NEWS_SOURCE] as const;
type Source = (typeof SOURCES)[number];

const FetchListingsPayloadSchema = z.object({
  runId: z.uuid(),
  source: z.enum(SOURCES).default(SOURCES[0]),
  /** How many jobs the earlier sources read this night. */
  readSoFar: z.number().int().min(0).default(0),
});
type FetchListingsPayload = z.infer<typeof FetchListingsPayloadSchema>;

/** Each source's jobs since the given time, in the common format. */
const FETCH_FROM: Record<Source, (since: Date, runId: string) => Promise<Listing[]>> = {
  [HIMALAYAS_SOURCE]: async (since, runId) => (await fetchHimalayasJobs(since)).map((job) => himalayasListing(job, runId)),
  // The thread is read whole each night; posts saved before are skipped when saving.
  [HACKER_NEWS_SOURCE]: async (_since, runId) => (await fetchHackerNewsPosts()).map((post) => hackerNewsListing(post, runId)),
};

// The first run reads back a day. Later runs read back to the last run's start, less a margin for jobs
// published while it ran; a job read twice is saved once.
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const OVERLAP_MS = 60 * 60 * 1000;

export async function fetchListings(payload: Json): Promise<void> {
  const { runId, source, readSoFar } = FetchListingsPayloadSchema.parse(payload);

  if ((await loadSpendingCap(getAdminClient())).reached) {
    // Expired listings are still removed, as Himalayas' terms ask.
    await deleteExpiredListings();
    await finishRun(runId);
    return;
  }

  const [since, settings] = await Promise.all([fetchSince(runId), loadFilterSettings()]);
  const listings = (await FETCH_FROM[source](since, runId)).map((listing) => ({
    ...listing,
    ...eligibilityOf(listing, settings),
  }));

  await saveNewListings(listings);
  await goOn({ runId, source, readSoFar: readSoFar + listings.length });
}

/** After a source failed every attempt: the night goes on without it (AGENTS.md, Architecture rule 12). */
export async function fetchingGaveUp(payload: Json): Promise<void> {
  await goOn(FetchListingsPayloadSchema.parse(payload));
}

/** Queues the next source, or, after the last one, finishes fetching and starts scoring. */
async function goOn({ runId, source, readSoFar }: FetchListingsPayload): Promise<void> {
  const next = SOURCES[SOURCES.indexOf(source) + 1];
  if (next) {
    await enqueueStep(STEP_NAMES.fetchListings, { runId, source: next, readSoFar });
    return;
  }
  await deleteExpiredListings();
  await recordCounts(runId, readSoFar);
  await queueScoring(runId);
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

/** How many jobs the night read from every source, and how many new ones were kept for scoring (not excluded). */
async function recordCounts(runId: string, read: number): Promise<void> {
  const db = getAdminClient();
  const kept = await db
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .neq("eligibility", "excluded");
  if (kept.error) throw new Error(`Could not count the run's listings: ${kept.error.message}`);

  const saved = await db.from("runs").update({ listings_fetched: read, listings_kept: kept.count ?? 0 }).eq("id", runId);
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

const ROLE_WORDS =
  /engineer|developer|programmer|designer|scientist|analyst|architect|manager|lead|head of|director|founding|intern|\bsre\b|devops|researcher|consultant/i;
const URL = /https?:\/\/[^\s)]+/g;
/** How long a post stays in the database. Posts are read up to 30 days old, so one is never saved twice. */
const HACKER_NEWS_POST_DAYS = 45;

/**
 * A Hacker News hiring post in the common format. By the thread's custom, its first line reads
 * "Company | Role | Location | ..." (some use dashes): the company comes first, the role is the first part
 * that names one, and the other parts are kept as the location. The whole post is the description, read by
 * the filter and the scoring step. Pay is left unstated, so it never drops a post.
 */
export function hackerNewsListing(post: HackerNewsPost, runId: string): Listing {
  const description = hackerNewsText(post.text);
  const header = description.split("\n")[0];
  const parts = header
    .split(/\s*\|\s*|\s+[—–]\s+/)
    .map((part) => part.replace(URL, "").replace(/\(\s*\)/g, "").trim())
    .filter(Boolean);
  // A first line with no separator is taken whole as the title. "Acme (YC S18)" is kept as "Acme".
  const company = parts.length > 1 ? parts[0].replace(/\s*\([^)]*\)$/, "") : "";
  const rest = parts.slice(1);
  const titleIndex = Math.max(0, rest.findIndex((part) => ROLE_WORDS.test(part)));
  const title = (rest[titleIndex] ?? header.replace(URL, "").trim()).slice(0, 200) || "Job post";
  const location = rest.filter((_, index) => index !== titleIndex).join(" | ");

  const tags: string[] = [];
  if (REMOTE.test(header)) tags.push("remote");
  if (/\bcontract(or)?\b/i.test(header)) tags.push("contractor");
  if (offersVisa(description)) tags.push("visa");

  const postedAt = new Date(post.created_at_i * 1000);
  // A post whose first line names no company gets its own key, so it never stands in for another job.
  const companyName = company || `Hacker News post ${post.id}`;
  return {
    source: HACKER_NEWS_SOURCE,
    source_id: String(post.id),
    url: hackerNewsPostUrl(post.id),
    title,
    company: companyName,
    location: location || null,
    countries: [],
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    seniority: [],
    employment_type: null,
    categories: [],
    tags,
    description,
    fingerprint: jobKey(companyName, title),
    posted_at: postedAt.toISOString(),
    expires_at: new Date(postedAt.getTime() + HACKER_NEWS_POST_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    run_id: runId,
  };
}

/**
 * A post's HTML as plain text. Hacker News opens each paragraph with <p> and never closes it, and shortens
 * long link text with "...", so each link is replaced by its full address first.
 */
function hackerNewsText(html: string): string {
  return htmlToText(html.replace(/<a\s[^>]*href="([^"]*)"[^>]*>.*?<\/a>/gi, "$1").replace(/<p>/gi, "\n\n"));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** A job description's HTML as plain text, which is shorter and easier for a model to read. */
export function htmlToText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
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
