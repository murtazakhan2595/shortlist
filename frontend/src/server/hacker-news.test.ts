import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fetchHackerNewsPosts, hackerNewsPostUrl, MAX_POST_AGE_DAYS } from "./hacker-news";

const NOW = new Date("2026-10-24T00:00:00Z");
const DAY = 24 * 60 * 60;

function post(id: number, daysAgo: number, text: string | null = "Acme | Engineer | Remote") {
  return { id, text, created_at_i: NOW.getTime() / 1000 - daysAgo * DAY, author: "someone", children: [] };
}

// The two threads the whoishiring account posts at the same second, newest first.
const SEARCH = {
  hits: [
    { objectID: "2", title: "Ask HN: Who wants to be hired? (October 2026)" },
    { objectID: "1", title: "Ask HN: Who is hiring? (October 2026)" },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => vi.stubGlobal("fetch", fetchMock));

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function answer(search: unknown, thread: unknown) {
  fetchMock.mockImplementation(async (url: string) => Response.json(url.includes("/search_by_date") ? search : thread));
}

test("finds the hiring thread by its account and title, and says who is asking", async () => {
  answer(SEARCH, { id: 1, children: [] });

  await fetchHackerNewsPosts(NOW);

  const [searchUrl, init] = fetchMock.mock.calls[0];
  expect(searchUrl).toBe("https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5");
  expect(init.headers["User-Agent"]).toContain("shortlist");
  // "Who wants to be hired?" is skipped, though it comes first.
  expect(fetchMock.mock.calls[1][0]).toBe("https://hn.algolia.com/api/v1/items/1");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("keeps the posts with text from the last 30 days", async () => {
  answer(SEARCH, { id: 1, children: [post(10, 1), post(11, MAX_POST_AGE_DAYS + 1), post(12, 2, null), post(13, 3, "  ")] });

  const posts = await fetchHackerNewsPosts(NOW);

  expect(posts.map((kept) => kept.id)).toEqual([10]);
});

test("finds no posts when no hiring thread is up", async () => {
  answer({ hits: [{ objectID: "2", title: "Ask HN: Who wants to be hired? (October 2026)" }] }, {});

  expect(await fetchHackerNewsPosts(NOW)).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("fails on an answer other than 200, so the queue retries", async () => {
  fetchMock.mockResolvedValue(new Response("busy", { status: 429 }));

  await expect(fetchHackerNewsPosts(NOW)).rejects.toThrow("Hacker News search answered 429");
});

test("fails loudly when the answer's shape changes", async () => {
  answer({ results: [] }, {});

  await expect(fetchHackerNewsPosts(NOW)).rejects.toThrow();
});

test("links each post to its own page", () => {
  expect(hackerNewsPostUrl(49922600)).toBe("https://news.ycombinator.com/item?id=49922600");
});
