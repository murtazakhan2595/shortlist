import "server-only";
import { z } from "zod";

// Greenhouse's Job Board API (docs.greenhouse.io/job-board.html, read 26 October 2026): "Job Board data is
// publicly available, so authentication is not required for any GET endpoints." No rate limit is published,
// so boards are read a few at a time, and only the cheap list of titles unless a job is worth more.

export const GREENHOUSE_SOURCE = "greenhouse";

const API_URL = "https://boards-api.greenhouse.io/v1/boards";
const USER_AGENT = "shortlist (personal job search, one run a day)";
const TIMEOUT_MS = 15_000;

const BoardJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
});
export type GreenhouseBoardJob = z.infer<typeof BoardJobSchema>;

const BoardSchema = z.object({ jobs: z.array(BoardJobSchema) });

/** A board's open jobs, titles and locations only. Null when the board no longer exists. */
export async function fetchGreenhouseBoard(slug: string): Promise<GreenhouseBoardJob[] | null> {
  const response = await fetch(`${API_URL}/${encodeURIComponent(slug)}/jobs`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Greenhouse answered ${response.status} for board ${slug}`);
  return BoardSchema.parse(await response.json()).jobs;
}
