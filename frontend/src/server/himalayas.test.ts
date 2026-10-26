import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DELAY_BETWEEN_PAGES_MS, fetchHimalayasJobs, MAX_PAGES } from "./himalayas";

const NOW = new Date("2026-10-21T00:00:00Z");
const SINCE = new Date("2026-10-20T00:00:00Z");
const HOUR = 60 * 60;

function job(id: string, hoursAgo: number) {
  return {
    guid: `https://himalayas.app/companies/acme/jobs/${id}`,
    title: "Full Stack Engineer",
    companyName: "Acme",
    applicationLink: `https://himalayas.app/companies/acme/jobs/${id}?utm_source=api`,
    description: "<p>Build things.</p>",
    pubDate: NOW.getTime() / 1000 - hoursAgo * HOUR,
    expiryDate: null,
    employmentType: "Full Time",
    seniority: ["Mid-level"],
    parentCategories: ["Developer"],
    locationRestrictions: [],
    minSalary: null,
    maxSalary: null,
    currency: null,
    salaryPeriod: null,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

async function fetchJobs(pages: unknown[][]) {
  const requestTimes: number[] = [];
  fetchMock.mockImplementation(async () => {
    requestTimes.push(Date.now());
    return Response.json({ jobs: pages[requestTimes.length - 1] ?? [] });
  });
  const result = fetchHimalayasJobs(SINCE);
  await vi.runAllTimersAsync();
  return { jobs: await result, requestTimes };
}

test("asks for jobs open to Pakistan, newest first, and says who is asking", async () => {
  await fetchJobs([[]]);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://himalayas.app/jobs/api/search?country=PK&sort=recent&page=1");
  expect(init.headers["User-Agent"]).toContain("shortlist");
});

test("reads pages a second apart until a page has no new job, and keeps each job once", async () => {
  const { jobs, requestTimes } = await fetchJobs([
    // A job that changed lately is moved up the first page, though it is old.
    [job("old-but-moved-up", 100), job("a", 1), job("b", 2)],
    [job("b", 2), job("c", 20)],
    [job("d", 30), job("e", 40)],
  ]);

  expect(jobs.map((found) => found.guid.split("/").at(-1))).toEqual(["a", "b", "c"]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(requestTimes[1] - requestTimes[0]).toBeGreaterThanOrEqual(DELAY_BETWEEN_PAGES_MS);
  expect(requestTimes[2] - requestTimes[1]).toBeGreaterThanOrEqual(DELAY_BETWEEN_PAGES_MS);
});

test(`never reads more than ${MAX_PAGES} pages`, async () => {
  const pages = Array.from({ length: MAX_PAGES + 5 }, (_, page) => [job(`job-${page}`, 1)]);

  const { jobs } = await fetchJobs(pages);

  expect(fetchMock).toHaveBeenCalledTimes(MAX_PAGES);
  expect(jobs).toHaveLength(MAX_PAGES);
});

test("fails on a refusal such as too many requests, so the queue retries later", async () => {
  fetchMock.mockResolvedValue(new Response("Too many requests", { status: 429 }));

  await expect(fetchHimalayasJobs(SINCE)).rejects.toThrow("Himalayas answered 429 for page 1");
});

test("fails loudly when Himalayas changes the shape of its answer", async () => {
  fetchMock.mockResolvedValue(Response.json({ jobs: [{ title: "No id or link" }] }));

  await expect(fetchHimalayasJobs(SINCE)).rejects.toThrow();
});
