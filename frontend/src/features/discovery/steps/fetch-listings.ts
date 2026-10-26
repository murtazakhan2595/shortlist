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

// The daily run's first step, one source per call: each source's step queues the next, and the last
// queues scoring. Excluded listings are saved too, so the filter's choices can be checked.
// Safe to run twice: listings already saved are skipped, and only unscored ones are queued.

const SOURCES = [HIMALAYAS_SOURCE, HACKER_NEWS_SOURCE] as const;
type Source = (typeof SOURCES)[number];

const FetchListingsPayloadSchema = z.object({
  runId: z.uuid(),
  source: z.enum(SOURCES).default(SOURCES[0]),
  readSoFar: z.number().int().min(0).default(0),
});
type FetchListingsPayload = z.infer<typeof FetchListingsPayloadSchema>;

const FETCHERS: Record<Source, (since: Date, runId: string) => Promise<Listing[]>> = {
  [HIMALAYAS_SOURCE]: async (since, runId) => (await fetchHimalayasJobs(since)).map((job) => himalayasListing(job, runId)),
  // The thread is read whole each time; posts saved before are skipped when saving.
  [HACKER_NEWS_SOURCE]: async (_since, runId) => (await fetchHackerNewsPosts()).map((post) => hackerNewsListing(post, runId)),
};

// The overlap catches jobs published while the last run ran; a job read twice is saved once.
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const OVERLAP_MS = 60 * 60 * 1000;

export async function fetchListings(payload: Json): Promise<void> {
  const { runId, source, readSoFar } = FetchListingsPayloadSchema.parse(payload);

  // At the spending cap nothing could be scored, so nothing is fetched.
  if ((await loadSpendingCap(getAdminClient())).reached) {
    // Expired listings are still removed, as Himalayas' terms ask.
    await deleteExpiredListings();
    await finishRun(runId);
    return;
  }

  const [since, settings] = await Promise.all([fetchSince(runId), loadFilterSettings()]);
  const listings = (await FETCHERS[source](since, runId)).map((listing) => ({
    ...listing,
    ...eligibilityOf(listing, settings),
  }));

  await saveNewListings(listings);
  await queueNextSourceOrScore({ runId, source, readSoFar: readSoFar + listings.length });
}

/** After a source's last failed attempt, so the run goes on with the other sources. */
export async function skipFailedSource(payload: Json): Promise<void> {
  await queueNextSourceOrScore(FetchListingsPayloadSchema.parse(payload));
}

async function queueNextSourceOrScore({ runId, source, readSoFar }: FetchListingsPayload): Promise<void> {
  const next = SOURCES[SOURCES.indexOf(source) + 1];
  if (next) {
    await enqueueStep(STEP_NAMES.fetchListings, { runId, source: next, readSoFar });
    return;
  }
  await deleteExpiredListings();
  await recordCounts(runId, readSoFar);
  await queueScoring(runId);
}

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

// --- One format for every source ---

const SALARY_PERIODS: Record<string, Listing["salary_period"]> = { hourly: "hour", monthly: "month", annual: "year" };

export function himalayasListing(job: HimalayasJob, runId: string): Listing {
  const tags = ["remote"]; // Himalayas lists remote jobs only.
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
    // The same job from two sources gets the same key, so it is stored once.
    fingerprint: jobKey(job.companyName, job.title),
    posted_at: new Date(job.pubDate * 1000).toISOString(),
    expires_at: job.expiryDate ? new Date(job.expiryDate * 1000).toISOString() : null,
    run_id: runId,
    // Himalayas jobs are applied to through their link (its terms).
    contact_email: null,
  };
}

const ROLE_WORDS =
  /engineer|developer|programmer|designer|scientist|analyst|architect|manager|lead|head of|director|founding|intern|\bsre\b|devops|researcher|consultant/i;
const URL = /https?:\/\/[^\s)]+/g;
/** Longer than the 30 days posts are read back, so a post is never saved twice. */
const HACKER_NEWS_POST_DAYS = 45;

// By the thread's custom, a post's first line reads "Company | Role | Location | ..." (some use dashes).
// Pay is left unstated, so it never drops a post.
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
    contact_email: contactEmailIn(description),
  };
}

// "jobs@acme.com", and the spelled-out forms posts use against spam: "jobs [at] acme [dot] com",
// "jobs (at) acme (dot) io". A bare "jobs at acme dot com" is left out: "engineers at acme" reads the same.
const PLAIN_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const SPELLED_EMAIL = /([\w.+-]+)\s*[[(]\s*at\s*[\])]\s*([\w-]+(?:\s*(?:[[(]\s*dot\s*[\])]|\.)\s*[\w-]+)+)/i;

/** Read by code, never by a model, so a draft's recipient is always an address that is in the post. */
export function contactEmailIn(text: string): string | null {
  const plain = text.match(PLAIN_EMAIL)?.[0];
  const spelled = text.match(SPELLED_EMAIL);
  const plainAt = plain ? text.indexOf(plain) : Infinity;
  const spelledAt = spelled?.index ?? Infinity;
  if (spelled && spelledAt < plainAt) {
    const domain = spelled[2].replace(/\s*(?:[[(]\s*dot\s*[\])]|\.)\s*/gi, ".");
    return `${spelled[1]}@${domain}`.toLowerCase();
  }
  return plain ? plain.replace(/\.+$/, "").toLowerCase() : null;
}

// Hacker News never closes <p>, and shortens long link text with "...", so links become their full address.
function hackerNewsText(html: string): string {
  return htmlToText(html.replace(/<a\s[^>]*href="([^"]*)"[^>]*>.*?<\/a>/gi, "$1").replace(/<p>/gi, "\n\n"));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

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

/** The database skips jobs already saved from any source, captured, or answered a form for. */
export async function saveNewListings(listings: (Listing & Eligibility)[]): Promise<string[]> {
  if (listings.length === 0) return [];
  const { data, error } = await getAdminClient().rpc("save_new_listings", { new_listings: listings });
  if (error) throw new Error(`Could not save the listings: ${error.message}`);
  return data;
}

/** Himalayas' terms ask that expired listings are removed. */
export async function deleteExpiredListings(): Promise<number> {
  const { data, error } = await getAdminClient().rpc("delete_expired_listings");
  if (error) throw new Error(`Could not delete expired listings: ${error.message}`);
  return data;
}
