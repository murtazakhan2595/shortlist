import "server-only";
import { z } from "zod";

// Himalayas' public jobs API (PLAN.md item 4.1): the jobs open to Pakistan, worldwide ones included, posted
// since a given time. Its terms ("Terms and Conditions for API Users" at himalayas.app/terms, read on
// 21 October 2026) and its limits are kept here, beside the code that follows them:
//
// - Every apply action uses the applicationLink it supplies. Himalayas is shown as the source, with a
//   visible link to the job: the listing's url is that link (D7).
// - Its jobs are never passed on to other job boards, aggregators or job search engines.
// - Expired jobs are removed: the daily run deletes them (delete_expired_listings).
// - Requests stay within its limits. Without an API key, every caller shares one allowance, so pages are
//   read one at a time, a second apart, once a day: its data refreshes daily, so more often gains nothing.
//   An answer other than 200, such as 429 (too many requests), fails the step, and the queue retries later.

export const HIMALAYAS_SOURCE = "himalayas";

const SEARCH_URL = "https://himalayas.app/jobs/api/search";
const USER_AGENT = "shortlist (personal job search, one run a day)";
// Jobs open to Pakistan include worldwide ones. "recent" sorts by date posted, newest first.
const SEARCH_PARAMS = { country: "PK", sort: "recent" };
export const DELAY_BETWEEN_PAGES_MS = 1_000;
// 20 jobs a page, so up to 400 jobs. The most seen in one day was 154. Reading 20 pages a second apart
// stays well inside the 60-second step budget.
export const MAX_PAGES = 20;

const HimalayasJobSchema = z.object({
  guid: z.string().min(1),
  title: z.string().min(1),
  companyName: z.string().min(1),
  /** The Himalayas page for the job: the link to apply through and to credit Himalayas with. */
  applicationLink: z.url(),
  /** HTML. */
  description: z.string(),
  /** Unix seconds, as are expiryDate and pubDate. */
  pubDate: z.number(),
  expiryDate: z.number().nullish(),
  employmentType: z.string().nullish(),
  seniority: z.array(z.string()).default([]),
  parentCategories: z.array(z.string()).default([]),
  /** The countries candidates must be in; empty for a worldwide job. */
  locationRestrictions: z.array(z.string()).default([]),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  currency: z.string().nullish(),
  /** "hourly", "monthly" or "annual". */
  salaryPeriod: z.string().nullish(),
});
export type HimalayasJob = z.infer<typeof HimalayasJobSchema>;

const SearchPageSchema = z.object({ jobs: z.array(HimalayasJobSchema) });

/**
 * The jobs posted since the given time. Results come newest first, though a few older jobs that changed
 * lately are moved up, so reading stops at the first page with no job posted since then.
 */
export async function fetchHimalayasJobs(since: Date): Promise<HimalayasJob[]> {
  const jobsById = new Map<string, HimalayasJob>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));

    const url = `${SEARCH_URL}?${new URLSearchParams({ ...SEARCH_PARAMS, page: String(page) })}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Himalayas answered ${response.status} for page ${page}`);

    const { jobs } = SearchPageSchema.parse(await response.json());
    const newJobs = jobs.filter((job) => job.pubDate * 1000 >= since.getTime());
    // The same job can appear on two pages when the list moves while it is read.
    for (const job of newJobs) jobsById.set(job.guid, job);
    if (newJobs.length === 0) break;
  }

  return [...jobsById.values()];
}
