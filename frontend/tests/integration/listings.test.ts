import { randomUUID } from "node:crypto";
import { afterAll, expect, test, vi } from "vitest";
import {
  deleteExpiredListings,
  skipFailedSource,
  fetchListings,
  himalayasListing,
  saveNewListings,
} from "@/features/discovery/steps/fetch-listings";
import type { GreenhouseJob } from "@/server/greenhouse";
import type { HackerNewsPost } from "@/server/hacker-news";
import type { HimalayasJob } from "@/server/himalayas";
import { getAdminClient } from "@/server/supabase/admin";
import { TEST_RUN_STARTED_AT } from "./test-runs";

// The SQL rules are tested in supabase/tests/database/listings.test.sql.
const himalayasJobs = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock("@/server/himalayas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/himalayas")>()),
  fetchHimalayasJobs: vi.fn(async () => himalayasJobs.value),
}));
const hackerNewsPosts = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock("@/server/hacker-news", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/hacker-news")>()),
  fetchHackerNewsPosts: vi.fn(async () => hackerNewsPosts.value),
}));

// The board reading itself is tested in company-boards.test.ts.
const greenhouseReads = vi.hoisted(() => ({ value: [] as { jobs: unknown[]; after?: string }[] }));
vi.mock("@/features/discovery/steps/company-boards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/discovery/steps/company-boards")>()),
  readWatchedGreenhouseBoards: vi.fn(async () => greenhouseReads.value.shift() ?? { jobs: [] }),
}));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
  wakeWorker: async () => {},
}));

// The monthly cap is not reached here; spending-cap.test.ts covers the cap.
vi.mock("@/server/spending", () => ({ loadSpendingCap: async () => ({ spentUsd: 0, capUsd: 50, reached: false }) }));

const database = getAdminClient();
const runId = randomUUID();
const stepRunId = randomUUID();
const gaveUpRunId = randomUUID();
const company = `Integration Test ${randomUUID()}`;
// Hacker News posts are keyed by id, so each test run uses ids no real post has.
const postId = -Math.floor(Math.random() * 1e9);

afterAll(async () => {
  await database.from("listings").delete().eq("company", company);
  await database.from("runs").delete().in("id", [runId, stepRunId, gaveUpRunId]);
});

function hackerNewsPost(id: number, place: string): HackerNewsPost {
  return { id, text: `${company} | Backend Engineer ${id} | ${place}<p>Details.`, created_at_i: Date.now() / 1000 };
}

function greenhouseJob(location: string): GreenhouseJob {
  return {
    id: Math.floor(Math.random() * 1e9),
    title: `Platform Engineer ${runId}`,
    company_name: company,
    location: { name: location },
    first_published: new Date().toISOString(),
    absolute_url: "https://job-boards.greenhouse.io/test/jobs/1",
    content: "&lt;p&gt;Build our platform.&lt;/p&gt;",
    offices: [],
  };
}

function job(id: string, expiryDate: number | null): HimalayasJob {
  return {
    guid: `https://himalayas.app/companies/test/jobs/${id}-${runId}`,
    title: `Engineer ${id}`,
    companyName: company,
    applicationLink: `https://himalayas.app/companies/test/jobs/${id}?utm_source=api`,
    description: "<p>A job.</p>",
    pubDate: Date.now() / 1000,
    expiryDate,
    employmentType: "Contractor",
    seniority: ["Senior"],
    parentCategories: ["Developer"],
    locationRestrictions: ["Pakistan"],
    minSalary: 3000,
    maxSalary: 4000,
    currency: "USD",
    salaryPeriod: "monthly",
  };
}

test("saves new listings whole, saves nothing the second time, and deletes expired ones", async () => {
  const run = await database.from("runs").insert({ id: runId, kind: "daily", started_at: TEST_RUN_STARTED_AT });
  if (run.error) throw run.error;
  const eligible = { eligibility: "eligible", eligibility_reason: null };
  const listings = [
    { ...himalayasListing(job("open", Date.now() / 1000 + 86_400), runId), ...eligible },
    { ...himalayasListing(job("expired", Date.now() / 1000 - 86_400), runId), ...eligible },
  ];

  expect(await saveNewListings(listings)).toHaveLength(2);
  // Only the open listing is saved again: another test file may delete expired listings in between (they
  // share the one database), and then the expired one would rightly be new.
  expect(await saveNewListings([listings[0]])).toEqual([]);

  const { data: saved } = await database
    .from("listings")
    .select("seniority, countries, tags, salary_period, description, run_id")
    .eq("source_id", listings[0].source_id)
    .single();
  expect(saved).toEqual({
    seniority: ["Senior"],
    countries: ["Pakistan"],
    tags: ["remote", "contractor"],
    salary_period: "month",
    description: "A job.",
    run_id: runId,
  });

  // Another test file may delete the expired listing first, so only what is left is checked.
  await deleteExpiredListings();
  const { data: left } = await database.from("listings").select("title").eq("company", company);
  expect(left).toEqual([{ title: "Engineer open" }]);
});

test("the night reads each source in turn, saves its listings with the filter's decisions, once, and queues the kept ones to be scored", async () => {
  const run = await database.from("runs").insert({ id: stepRunId, kind: "daily", started_at: TEST_RUN_STARTED_AT });
  if (run.error) throw run.error;
  const salesJob = { ...job("sales", null), title: "Account Manager", parentCategories: ["Sales"] };
  himalayasJobs.value = [job("developer", null), salesJob];
  hackerNewsPosts.value = [hackerNewsPost(postId, "REMOTE (Worldwide)"), hackerNewsPost(postId - 1, "San Francisco | ONSITE")];

  // Himalayas first, twice, as a retry would: each time it hands on to Hacker News.
  await fetchListings({ runId: stepRunId });
  await fetchListings({ runId: stepRunId });
  const next = { runId: stepRunId, source: "hackernews", readSoFar: 2 };
  expect(queued.splice(0)).toEqual([
    { step: "fetch_listings", payload: next },
    { step: "fetch_listings", payload: next },
  ]);

  await fetchListings(next);
  await fetchListings(next);
  const toGreenhouse = { runId: stepRunId, source: "greenhouse", readSoFar: 4 };
  expect(queued.splice(0)).toEqual([
    { step: "fetch_listings", payload: toGreenhouse },
    { step: "fetch_listings", payload: toGreenhouse },
  ]);

  // Greenhouse is read over two steps: the first stops after a batch of boards.
  greenhouseReads.value = [{ jobs: [{ job: greenhouseJob("Remote"), company }], after: "acme" }];
  await fetchListings(toGreenhouse);
  const onwards = { ...toGreenhouse, readSoFar: 5, after: "acme" };
  expect(queued.splice(0)).toEqual([{ step: "fetch_listings", payload: onwards }]);
  await fetchListings(onwards);

  const { data: saved } = await database
    .from("listings")
    .select("id, source, title, eligibility, eligibility_reason")
    .eq("run_id", stepRunId)
    .order("title");
  expect(saved).toEqual([
    { id: expect.any(String), source: "himalayas", title: "Account Manager", eligibility: "excluded", eligibility_reason: "Not a technical role" },
    { id: expect.any(String), source: "hackernews", title: `Backend Engineer ${postId}`, eligibility: "eligible", eligibility_reason: null },
    {
      id: expect.any(String),
      source: "hackernews",
      title: `Backend Engineer ${postId - 1}`,
      eligibility: "excluded",
      eligibility_reason: "On-site or hybrid, with no visa sponsorship",
    },
    { id: expect.any(String), source: "himalayas", title: "Engineer developer", eligibility: "eligible", eligibility_reason: null },
    { id: expect.any(String), source: "greenhouse", title: `Platform Engineer ${runId}`, eligibility: "eligible", eligibility_reason: null },
  ]);
  const { data: counted } = await database.from("runs").select("status, listings_fetched, listings_kept").eq("id", stepRunId).single();
  expect(counted).toEqual({ status: "running", listings_fetched: 5, listings_kept: 3 });

  // Only the kept listings are scored.
  const keptIds = [saved?.[1].id, saved?.[3].id, saved?.[4].id];
  const scoring = queued.splice(0);
  expect(scoring.map((step) => step.step)).toEqual(Array(3).fill("score_listing"));
  expect(new Set(scoring.map((step) => (step.payload as { listingId: string }).listingId))).toEqual(new Set(keptIds));
});

test("a source that failed every attempt is skipped, and the night goes on", async () => {
  const run = await database.from("runs").insert({ id: gaveUpRunId, kind: "daily", started_at: TEST_RUN_STARTED_AT });
  if (run.error) throw run.error;

  await skipFailedSource({ runId: gaveUpRunId });
  expect(queued.splice(0)).toEqual([
    { step: "fetch_listings", payload: { runId: gaveUpRunId, source: "hackernews", readSoFar: 0 } },
  ]);

  await skipFailedSource({ runId: gaveUpRunId, source: "hackernews", readSoFar: 0 });
  expect(queued.splice(0)).toEqual([
    { step: "fetch_listings", payload: { runId: gaveUpRunId, source: "greenhouse", readSoFar: 0 } },
  ]);

  // The last source giving up, even part way through its boards, still finishes fetching: nothing was saved,
  // so the run goes straight to its list.
  await skipFailedSource({ runId: gaveUpRunId, source: "greenhouse", readSoFar: 0, after: "acme" });
  expect(queued.splice(0)).toEqual([{ step: "select_top_listings", payload: { runId: gaveUpRunId } }]);
});
