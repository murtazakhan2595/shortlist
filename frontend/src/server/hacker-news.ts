// Ported from: https://github.com/career-ops-hq/career-ops/blob/6caf821f1b852f27a63b297484617784c47b8b2a/providers/hackernews.mjs (MIT)
// Taken: finding the thread by account and title, and reading it in one Algolia request.
// Left out: URL guessing and the "remote" keyword filter.
import "server-only";
import { z } from "zod";

// The monthly "Ask HN: Who is hiring?" thread, read through Algolia's HN Search API, which allows 10,000
// requests an hour; a night makes two. news.ycombinator.com is never read: Y Combinator's terms forbid scraping.

export const HACKER_NEWS_SOURCE = "hackernews";

const API_URL = "https://hn.algolia.com/api/v1";
const USER_AGENT = "shortlist (personal job search, one run a day)";
// "Who wants to be hired?" is posted by the same account at the same second, so the title decides.
const HIRING_THREAD_TITLE = /ask\s+hn[:\s]+who\s+is\s+hiring/i;
// Once the next month's thread is up, the old one's job is done.
export const MAX_POST_AGE_DAYS = 30;

const SearchSchema = z.object({
  hits: z.array(z.object({ objectID: z.string(), title: z.string().nullish() })),
});

const PostSchema = z.object({
  id: z.number(),
  /** HTML. Null for a deleted post. */
  text: z.string().nullish(),
  /** Unix seconds. */
  created_at_i: z.number(),
});
export type HackerNewsPost = z.infer<typeof PostSchema> & { text: string };

const ThreadSchema = z.object({ id: z.number(), children: z.array(PostSchema).default([]) });

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Hacker News search answered ${response.status} for ${path}`);
  return response.json();
}

export async function fetchHackerNewsPosts(now = new Date()): Promise<HackerNewsPost[]> {
  const search = SearchSchema.parse(await getJson("/search_by_date?tags=story,author_whoishiring&hitsPerPage=5"));
  const thread = search.hits.find((hit) => HIRING_THREAD_TITLE.test(hit.title ?? ""));
  if (!thread) return [];

  // Algolia sends the whole thread in one answer, with deleted and flagged posts already left out.
  const { children } = ThreadSchema.parse(await getJson(`/items/${thread.objectID}`));
  const oldest = now.getTime() / 1000 - MAX_POST_AGE_DAYS * 24 * 60 * 60;
  return children.filter((post): post is HackerNewsPost => Boolean(post.text?.trim()) && post.created_at_i >= oldest);
}

export function hackerNewsPostUrl(postId: number): string {
  return `https://news.ycombinator.com/item?id=${postId}`;
}
