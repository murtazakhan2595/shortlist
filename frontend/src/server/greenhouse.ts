import "server-only";
import { z } from "zod";

// Greenhouse's Job Board API (docs.greenhouse.io/job-board.html, read 26 October 2026): "Job Board data is
// publicly available, so authentication is not required for any GET endpoints." No rate limit is published,
// so boards are read a few at a time, and a full post only for a job worth reading.

export const GREENHOUSE_SOURCE = "greenhouse";

const API_URL = "https://boards-api.greenhouse.io/v1/boards";
const USER_AGENT = "shortlist (personal job search, one run a day)";
const TIMEOUT_MS = 15_000;

const BoardJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  first_published: z.string().nullish(),
});
export type GreenhouseBoardJob = z.infer<typeof BoardJobSchema>;

const BoardSchema = z.object({ jobs: z.array(BoardJobSchema) });

const JobSchema = BoardJobSchema.extend({
  absolute_url: z.url(),
  /** HTML with its tags entity-encoded ("&lt;p&gt;"). */
  content: z.string(),
  // A location of just "Remote" can hide its region here ("Remote US").
  offices: z.array(z.object({ name: z.string() })).default([]),
});
export type GreenhouseJob = z.infer<typeof JobSchema>;

async function getJson(path: string): Promise<unknown | null> {
  const response = await fetch(`${API_URL}/${path}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Greenhouse answered ${response.status} for ${path}`);
  return response.json();
}

/** A board's open jobs, titles and locations only. Null when the board no longer exists. */
export async function fetchGreenhouseBoard(slug: string): Promise<GreenhouseBoardJob[] | null> {
  const board = await getJson(`${encodeURIComponent(slug)}/jobs`);
  return board === null ? null : BoardSchema.parse(board).jobs;
}

/** One job with its full post. Null when it has closed since its board was read. */
export async function fetchGreenhouseJob(slug: string, jobId: number): Promise<GreenhouseJob | null> {
  const job = await getJson(`${encodeURIComponent(slug)}/jobs/${jobId}`);
  return job === null ? null : JobSchema.parse(job);
}
