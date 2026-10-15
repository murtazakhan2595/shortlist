// Himalayas yield check (PLAN.md item 1.9).
//
// Counts how many jobs posted on Himalayas in the last 24 hours are open to Pakistan and pass
// broad versions of the stage 1 filters (D3, D3a, Q2, Q3). Run once a day for seven days,
// it answers whether one source can supply enough eligible jobs a day (PLAN.md section 8).
//
// The filters only drop jobs that are clearly out, so no model credits are spent on them.
// Anything unclear is kept; judging fit is the scoring step's job (D5).
//
// Run: pnpm yield-check

import { appendFileSync } from "node:fs";
import { z } from "zod";

const SEARCH_URL = "https://himalayas.app/jobs/api/search";
const USER_AGENT = "shortlist-yield-check (personal job search, one run a day)";
const DAY_SECONDS = 24 * 60 * 60;
const MAX_PAGES = 30;
const DELAY_BETWEEN_PAGES_MS = 1_000;

// Himalayas categories that are clearly not technical roles.
const NON_TECH_CATEGORIES = [
  "Sales",
  "Human Resources",
  "Customer Service",
  "Marketing",
  "Finance",
  "Legal",
  "Logistics",
  "Operations",
  "Content Creator",
  "Growth",
];
// A job in a non-technical category is still kept when its title looks technical, e.g. "DevOps Engineer".
const TECH_TITLE = /software|engineer|developer|programmer|full[- ]?stack|front[- ]?end|back[- ]?end|\bai\b|\bml\b|machine learning|data/i;

// Q2: mid-level and senior. Entry-level and unlabelled jobs are kept; only roles clearly above the range are dropped.
const LEVELS_ABOVE_RANGE = ["Manager", "Director", "Executive"];
const TITLE_ABOVE_RANGE = /\b(lead|staff|principal)\b/i;

const CLEARANCE_OR_CITIZENSHIP = /security clearance|must be a u\.?s\.? citizen|citizenship is required/i;

// Rough rates, good enough for an estimate. The real filter (item 4.3) will use live rates.
const USD_PER_UNIT: Record<string, number> = { USD: 1, EUR: 1.1, GBP: 1.3 };
const MONTHLY_MULTIPLIER: Record<string, number> = { hourly: 160, monthly: 1, annual: 1 / 12 };

const JobSchema = z.object({
  title: z.string(),
  companyName: z.string(),
  guid: z.string(),
  pubDate: z.number(),
  seniority: z.array(z.string()).default([]),
  parentCategories: z.array(z.string()).default([]),
  locationRestrictions: z.array(z.string()).default([]),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  salaryPeriod: z.string().nullish(),
  currency: z.string().nullish(),
  description: z.string().default(""),
});

const SearchPageSchema = z.object({ jobs: z.array(JobSchema) });

// The owner's filter settings, read from the settings table so the code holds no fixed values.
const FilterSettingsSchema = z.object({
  pay_floor_usd_month: z.number(),
  excluded_countries: z.array(z.string()),
});

export type Job = z.infer<typeof JobSchema>;

export type FilterSettings = {
  payFloorUsdMonth: number;
  excludedCountries: string[];
};

export type DropReason =
  | "not a technical role"
  | "seniority above range"
  | "pay below floor"
  | "clearance or citizenship required"
  | "excluded country";

/** Pay converted to US dollars a month, or null when the listing does not state it in a known currency. */
export function monthlyPayUsd(job: Job): number | null {
  const pay = job.maxSalary ?? job.minSalary;
  const rate = USD_PER_UNIT[job.currency ?? ""];
  const multiplier = MONTHLY_MULTIPLIER[job.salaryPeriod ?? ""];

  if (pay == null || rate === undefined || multiplier === undefined) return null;
  return pay * rate * multiplier;
}

function isClearlyNonTech(job: Job): boolean {
  const inNonTechCategory =
    job.parentCategories.length > 0 && job.parentCategories.every((category) => NON_TECH_CATEGORIES.includes(category));
  return inNonTechCategory && !TECH_TITLE.test(job.title);
}

function isAboveSeniorityRange(job: Job): boolean {
  const labelledAboveRange =
    job.seniority.length > 0 && job.seniority.every((level) => LEVELS_ABOVE_RANGE.includes(level));
  return labelledAboveRange || TITLE_ABOVE_RANGE.test(job.title);
}

/** Restricted to candidates in excluded countries only (D3a). */
function isOnlyForExcludedCountries(job: Job, excludedCountries: string[]): boolean {
  return (
    job.locationRestrictions.length > 0 &&
    job.locationRestrictions.every((country) => excludedCountries.includes(country))
  );
}

/** The first filter a job clearly fails, or null when it is kept. */
export function dropReason(job: Job, settings: FilterSettings): DropReason | null {
  if (isClearlyNonTech(job)) return "not a technical role";
  if (isAboveSeniorityRange(job)) return "seniority above range";

  const pay = monthlyPayUsd(job);
  if (pay !== null && pay < settings.payFloorUsdMonth) return "pay below floor";

  if (CLEARANCE_OR_CITIZENSHIP.test(job.description)) return "clearance or citizenship required";
  if (isOnlyForExcludedCountries(job, settings.excludedCountries)) return "excluded country";

  return null;
}

export type YieldReport = {
  date: string;
  newJobsOpenToPakistan: number;
  worldwide: number;
  listingPakistan: number;
  dropped: Partial<Record<DropReason, number>>;
  eligible: number;
  eligibleByCategory: Record<string, number>;
  eligibleJobs: string[];
};

export function buildReport(jobs: Job[], settings: FilterSettings, now: Date): YieldReport {
  const dropped: Partial<Record<DropReason, number>> = {};
  const eligibleByCategory: Record<string, number> = {};
  const eligibleJobs: string[] = [];

  for (const job of jobs) {
    const reason = dropReason(job, settings);
    if (reason) {
      dropped[reason] = (dropped[reason] ?? 0) + 1;
      continue;
    }

    const category = job.parentCategories[0] ?? "No category";
    eligibleByCategory[category] = (eligibleByCategory[category] ?? 0) + 1;
    eligibleJobs.push(`${job.title} at ${job.companyName} (${category})`);
  }

  return {
    date: now.toISOString().slice(0, 10),
    newJobsOpenToPakistan: jobs.length,
    worldwide: jobs.filter((job) => job.locationRestrictions.length === 0).length,
    listingPakistan: jobs.filter((job) => job.locationRestrictions.includes("Pakistan")).length,
    dropped,
    eligible: eligibleJobs.length,
    eligibleByCategory,
    eligibleJobs,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Reads the filter settings with the secret key, which bypasses the owner-only access rules. */
async function fetchFilterSettings(): Promise<FilterSettings> {
  const url = `${requiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/settings?select=pay_floor_usd_month,excluded_countries`;
  const response = await fetch(url, { headers: { apikey: requiredEnv("SUPABASE_SECRET_KEY") } });
  if (!response.ok) throw new Error(`Supabase returned ${response.status} for settings`);

  const [row] = z.array(FilterSettingsSchema).length(1).parse(await response.json());
  return { payFloorUsdMonth: row.pay_floor_usd_month, excludedCountries: row.excluded_countries };
}

function postedInLastDay(job: Job, now: Date): boolean {
  return now.getTime() / 1000 - job.pubDate < DAY_SECONDS;
}

/**
 * Jobs open to Pakistan (which includes worldwide jobs) posted in the last 24 hours.
 * Results come newest first, so paging stops at the first page that ends with an older job.
 */
async function fetchNewJobs(now: Date): Promise<Job[]> {
  const jobsById = new Map<string, Job>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(`${SEARCH_URL}?country=PK&page=${page}`, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Himalayas returned ${response.status} for page ${page}`);

    const { jobs } = SearchPageSchema.parse(await response.json());
    for (const job of jobs) {
      if (postedInLastDay(job, now)) jobsById.set(job.guid, job);
    }

    const lastJob = jobs.at(-1);
    if (!lastJob || !postedInLastDay(lastJob, now)) break;
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
  }

  return [...jobsById.values()];
}

function toMarkdown(report: YieldReport): string {
  const tableRows = (counts: Record<string, number>) =>
    Object.entries(counts).map(([name, count]) => `| ${name} | ${count} |`);

  return [
    `## Himalayas yield, ${report.date}`,
    "",
    `**${report.eligible} eligible** out of ${report.newJobsOpenToPakistan} new jobs open to Pakistan ` +
      `(${report.worldwide} worldwide, ${report.listingPakistan} listing Pakistan).`,
    "",
    "| Eligible, by category | Jobs |",
    "|---|---|",
    ...tableRows(report.eligibleByCategory),
    "",
    "| Dropped because | Jobs |",
    "|---|---|",
    ...tableRows(report.dropped),
    "",
    ...report.eligibleJobs.map((job) => `- ${job}`),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const now = new Date();
  const settings = await fetchFilterSettings();
  const report = buildReport(await fetchNewJobs(now), settings, now);

  console.log(JSON.stringify(report, null, 2));

  // In GitHub Actions, also show the report on the run's summary page.
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) appendFileSync(summaryFile, toMarkdown(report));
}

if (import.meta.main) {
  await main();
}
