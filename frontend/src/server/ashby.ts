import "server-only";
import { z } from "zod";
import { getBoardJson } from "./board-api";

// Ashby's public job posting API (developers.ashbyhq.com/docs/public-job-posting-api, read 26 October 2026):
// read with no key, and no rate limit is published. One request reads a whole board, full posts and pay
// included.

export const ASHBY_SOURCE = "ashby";

const API_URL = "https://api.ashbyhq.com/posting-api/job-board";

const CompensationComponentSchema = z.object({
  compensationType: z.string(),
  /** "1 YEAR", "1 MONTH", "1 HOUR", "NONE" and others. */
  interval: z.string().nullish(),
  currencyCode: z.string().nullish(),
  minValue: z.number().nullish(),
  maxValue: z.number().nullish(),
});
export type AshbyCompensationComponent = z.infer<typeof CompensationComponentSchema>;

const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  jobUrl: z.url(),
  publishedAt: z.string(),
  // Only reachable by its link when false.
  isListed: z.boolean().default(true),
  /** "Remote", "Hybrid" or "OnSite". It wins over isRemote, which is true for hybrid jobs too. */
  workplaceType: z.string().nullish(),
  isRemote: z.boolean().nullish(),
  location: z.string().nullish(),
  secondaryLocations: z.array(z.object({ location: z.string().nullish() })).default([]),
  address: z.object({ postalAddress: z.object({ addressCountry: z.string().nullish() }).nullish() }).nullish(),
  employmentType: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
  compensation: z
    .object({ compensationTiers: z.array(z.object({ components: z.array(CompensationComponentSchema).default([]) })).default([]) })
    .nullish(),
});
export type AshbyJob = z.infer<typeof JobSchema>;

const BoardSchema = z.object({ jobs: z.array(JobSchema) });

/** A board's open jobs in full, with pay where the company shows it. Null when the board no longer exists. */
export async function fetchAshbyBoard(slug: string): Promise<AshbyJob[] | null> {
  const board = await getBoardJson(`${API_URL}/${encodeURIComponent(slug)}?includeCompensation=true`, "Ashby");
  return board === null ? null : BoardSchema.parse(board).jobs;
}
