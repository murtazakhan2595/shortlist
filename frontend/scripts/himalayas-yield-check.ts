// Himalayas yield check (PLAN.md item 1.9).
//
// Counts how many jobs posted on Himalayas in the last 24 hours are open to Pakistan and pass
// simplified versions of the stage 1 filters (D3, D3a, Q2, Q3). Run once a day for seven days,
// it answers whether one source can supply enough eligible jobs a day (PLAN.md section 8).
//
// Run: pnpm yield-check

import { appendFileSync } from "node:fs";
import { z } from "zod";

const SEARCH_URL = "https://himalayas.app/jobs/api/search";
const USER_AGENT = "shortlist-yield-check (personal job search, one run a day)";
const DAY_SECONDS = 24 * 60 * 60;
const MAX_PAGES = 30;
const DELAY_BETWEEN_PAGES_MS = 1_000;

const PAY_FLOOR_USD_MONTH = 2_500;
const ALLOWED_SENIORITY = ["Mid-level", "Senior"];
const ROLE_CATEGORIES = ["Developer", "Data Science"];

const SOFTWARE_TITLE = /\b(engineer|developer|programmer)\b|full[- ]?stack|front[- ]?end|back[- ]?end/i;
const SENIORITY_ABOVE_RANGE = /\b(lead|staff|principal|head|director|vp|intern)\b/i;
const CLEARANCE_OR_CITIZENSHIP = /security clearance|must be a u\.?s\.? citizen|citizenship is required/i;
const BASED_IN_INDIA = /\b(based|located) in india\b/i;

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

export type Job = z.infer<typeof JobSchema>;

export type DropReason =
  | "not a software role"
  | "seniority out of range"
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

/** The first filter a job fails, or null when it is kept. Unclear cases are kept, as D4 requires. */
export function dropReason(job: Job): DropReason | null {
  const isSoftwareRole =
    job.parentCategories.some((category) => ROLE_CATEGORIES.includes(category)) && SOFTWARE_TITLE.test(job.title);
  if (!isSoftwareRole) return "not a software role";

  const seniorityStated = job.seniority.length > 0;
  const seniorityInRange = job.seniority.some((level) => ALLOWED_SENIORITY.includes(level));
  if ((seniorityStated && !seniorityInRange) || SENIORITY_ABOVE_RANGE.test(job.title)) return "seniority out of range";

  const pay = monthlyPayUsd(job);
  if (pay !== null && pay < PAY_FLOOR_USD_MONTH) return "pay below floor";

  if (CLEARANCE_OR_CITIZENSHIP.test(job.description)) return "clearance or citizenship required";

  if (BASED_IN_INDIA.test(job.description)) return "excluded country";

  return null;
}

export type YieldReport = {
  date: string;
  newJobsOpenToPakistan: number;
  worldwide: number;
  listingPakistan: number;
  dropped: Partial<Record<DropReason, number>>;
  eligible: number;
  eligibleJobs: string[];
};

export function buildReport(jobs: Job[], now: Date): YieldReport {
  const dropped: Partial<Record<DropReason, number>> = {};
  const eligibleJobs: string[] = [];

  for (const job of jobs) {
    const reason = dropReason(job);
    if (reason) dropped[reason] = (dropped[reason] ?? 0) + 1;
    else eligibleJobs.push(`${job.title} at ${job.companyName}`);
  }

  return {
    date: now.toISOString().slice(0, 10),
    newJobsOpenToPakistan: jobs.length,
    worldwide: jobs.filter((job) => job.locationRestrictions.length === 0).length,
    listingPakistan: jobs.filter((job) => job.locationRestrictions.includes("Pakistan")).length,
    dropped,
    eligible: eligibleJobs.length,
    eligibleJobs,
  };
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
  const droppedLines = Object.entries(report.dropped).map(([reason, count]) => `| ${reason} | ${count} |`);
  return [
    `## Himalayas yield, ${report.date}`,
    "",
    `**${report.eligible} eligible** out of ${report.newJobsOpenToPakistan} new jobs open to Pakistan ` +
      `(${report.worldwide} worldwide, ${report.listingPakistan} listing Pakistan).`,
    "",
    "| Dropped because | Jobs |",
    "|---|---|",
    ...droppedLines,
    "",
    ...report.eligibleJobs.map((job) => `- ${job}`),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const now = new Date();
  const report = buildReport(await fetchNewJobs(now), now);

  console.log(JSON.stringify(report, null, 2));

  // In GitHub Actions, also show the report on the run's summary page.
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) appendFileSync(summaryFile, toMarkdown(report));
}

if (import.meta.main) {
  await main();
}
