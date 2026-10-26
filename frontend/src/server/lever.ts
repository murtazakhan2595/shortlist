import "server-only";
import { z } from "zod";
import { getBoardJson } from "./board-api";

// Lever's postings API (github.com/lever/postings-api, read 26 October 2026): published postings are public
// and "may be scraped by third parties"; only applications sent through it are rate limited, and Shortlist
// sends none. One request reads a whole board, full posts included.

export const LEVER_SOURCE = "lever";

const API_URL = "https://api.lever.co/v0/postings";

const PostingSchema = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.url(),
  /** Unix milliseconds. */
  createdAt: z.number(),
  /** "remote", "hybrid", "on-site" or "unspecified". */
  workplaceType: z.string().nullish(),
  /** ISO 3166-1 alpha-2, or null. */
  country: z.string().nullish(),
  categories: z
    .object({
      location: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
      commitment: z.string().nullish(),
    })
    .default({}),
  descriptionPlain: z.string().default(""),
  /** Each list's content is HTML. */
  lists: z.array(z.object({ text: z.string(), content: z.string() })).default([]),
  additionalPlain: z.string().default(""),
  salaryRange: z
    .object({ min: z.number().nullish(), max: z.number().nullish(), currency: z.string().nullish(), interval: z.string().nullish() })
    .nullish(),
});
export type LeverPosting = z.infer<typeof PostingSchema>;

/** A board's open postings in full. Null when the board no longer exists. */
export async function fetchLeverBoard(slug: string): Promise<LeverPosting[] | null> {
  const board = await getBoardJson(`${API_URL}/${encodeURIComponent(slug)}?mode=json`, "Lever");
  return board === null ? null : z.array(PostingSchema).parse(board);
}
