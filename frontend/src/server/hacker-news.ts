// Ported from: https://github.com/career-ops-hq/career-ops/blob/6caf821f1b852f27a63b297484617784c47b8b2a/providers/hackernews.mjs (MIT)
// Taken: finding the thread by the whoishiring account and its title, and reading its posts from one
// Algolia request. Left out: career-ops's URL guessing and its "remote" keyword filter; Shortlist keeps
// each post's whole text and links to the post itself.
import "server-only";
import { z } from "zod";

// Hacker News's monthly "Ask HN: Who is hiring?" thread (PLAN.md sprint 7). Its terms and limits, read on
// 24 October 2026, are kept here beside the code that follows them:
//
// - Hacker News offers its data through public APIs (github.com/HackerNews/API, MIT). Shortlist reads
//   them through Algolia's HN Search API, which allows 10,000 requests an hour from one address; a night
//   makes two. The news.ycombinator.com pages themselves are never read: Y Combinator's terms forbid scraping.
// - Each listing links to its post on Hacker News (D7).
// - Contact details are used only to apply to that job, and nothing is sent: the owner sends every email.
//
// The thread is posted on the first weekday of each month, by the "whoishiring" account. Each top-level
// comment is one company's post; most arrive on the first day and almost none after two weeks.

export const HACKER_NEWS_SOURCE = "hackernews";

const API_URL = "https://hn.algolia.com/api/v1";
const USER_AGENT = "shortlist (personal job search, one run a day)";
// "Who wants to be hired?" is posted by the same account at the same second, so the title decides.
const HIRING_THREAD_TITLE = /ask\s+hn[:\s]+who\s+is\s+hiring/i;
/** Posts older than this are left out: the thread's job is done once the next month's is up. */
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

/** The posts in the latest hiring thread from the last MAX_POST_AGE_DAYS days, or none if no thread is found. */
export async function fetchHackerNewsPosts(now = new Date()): Promise<HackerNewsPost[]> {
  const search = SearchSchema.parse(await getJson("/search_by_date?tags=story,author_whoishiring&hitsPerPage=5"));
  const thread = search.hits.find((hit) => HIRING_THREAD_TITLE.test(hit.title ?? ""));
  if (!thread) return [];

  // Algolia sends the whole thread in one answer, with deleted and flagged posts already left out.
  const { children } = ThreadSchema.parse(await getJson(`/items/${thread.objectID}`));
  const oldest = now.getTime() / 1000 - MAX_POST_AGE_DAYS * 24 * 60 * 60;
  return children.filter((post): post is HackerNewsPost => Boolean(post.text?.trim()) && post.created_at_i >= oldest);
}

/** The post's own page on Hacker News: the link a listing keeps (D7). */
export function hackerNewsPostUrl(postId: number): string {
  return `https://news.ycombinator.com/item?id=${postId}`;
}
