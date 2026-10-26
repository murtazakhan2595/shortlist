import "server-only";
import { z } from "zod";

// Himalayas' public jobs API. Its terms (himalayas.app/terms, "Terms and Conditions for API Users"):
// - Apply through the applicationLink it supplies, and show Himalayas as the source with a link to the job.
// - Never pass its jobs on to other job boards, aggregators or job search engines.
// - Remove expired jobs (delete_expired_listings does).
// - Stay within its limits. Without an API key every caller shares one allowance, so pages are read one at
//   a time, a second apart, once a day; its data refreshes daily. A 429 fails the step and the queue retries.

export const HIMALAYAS_SOURCE = "himalayas";

const SEARCH_URL = "https://himalayas.app/jobs/api/search";
const USER_AGENT = "shortlist (personal job search, one run a day)";
// Jobs open to Pakistan include worldwide ones.
const SEARCH_PARAMS = { country: "PK", sort: "recent" };
export const DELAY_BETWEEN_PAGES_MS = 1_000;
// 20 jobs a page; the most seen in one day was 154. 20 pages a second apart fit the 60-second step budget.
export const MAX_PAGES = 20;

const HimalayasJobSchema = z.object({
  guid: z.string().min(1),
  title: z.string().min(1),
  companyName: z.string().min(1),
  applicationLink: z.url(),
  /** HTML. */
  description: z.string(),
  /** Unix seconds, as are expiryDate and pubDate. */
  pubDate: z.number(),
  expiryDate: z.number().nullish(),
  employmentType: z.string().nullish(),
  seniority: z.array(z.string()).default([]),
  parentCategories: z.array(z.string()).default([]),
  /** Empty for a worldwide job. */
  locationRestrictions: z.array(z.string()).default([]),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  currency: z.string().nullish(),
  /** "hourly", "monthly" or "annual". */
  salaryPeriod: z.string().nullish(),
});
export type HimalayasJob = z.infer<typeof HimalayasJobSchema>;

const SearchPageSchema = z.object({ jobs: z.array(HimalayasJobSchema) });

// A few older jobs that changed lately are moved up the newest-first list, so reading stops at the first
// page with no new job, not the first old one.
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
