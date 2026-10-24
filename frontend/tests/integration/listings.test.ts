import { randomUUID } from "node:crypto";
import { afterAll, expect, test, vi } from "vitest";
import {
  deleteExpiredListings,
  fetchingGaveUp,
  fetchListings,
  himalayasListing,
  saveNewListings,
} from "@/features/discovery/steps/fetch-listings";
import type { HackerNewsPost } from "@/server/hacker-news";
import type { HimalayasJob } from "@/server/himalayas";
import { getAdminClient } from "@/server/supabase/admin";

// The daily run's first steps against the real database, with Himalayas and Hacker News replaced by fakes.
// The SQL rules themselves are tested in supabase/tests/database/listings.test.sql; this checks the app's
// rows arrive whole and the sources are read one after another.
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

// Queued steps are collected here instead of going to the real queue.
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
  const run = await database.from("runs").insert({ id: runId, kind: "daily" });
  if (run.error) throw run.error;
  const eligible = { eligibility: "eligible", eligibility_reason: null };
  const listings = [
    { ...himalayasListing(job("open", Date.now() / 1000 + 86_400), runId), ...eligible },
    { ...himalayasListing(job("expired", Date.now() / 1000 - 86_400), runId), ...eligible },
  ];

  expect(await saveNewListings(listings)).toHaveLength(2);
  expect(await saveNewListings(listings)).toEqual([]);

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

  // Another test file may delete the expired listing first (they share the one database), so the count is
  // not checked; what is left is.
  await deleteExpiredListings();
  const { data: left } = await database.from("listings").select("title").eq("company", company);
  expect(left).toEqual([{ title: "Engineer open" }]);
});

test("the night reads each source in turn, saves its listings with the filter's decisions, once, and queues the kept ones to be scored", async () => {
  const run = await database.from("runs").insert({ id: stepRunId, kind: "daily" });
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
  ]);
  const { data: counted } = await database.from("runs").select("status, listings_fetched, listings_kept").eq("id", stepRunId).single();
  expect(counted).toEqual({ status: "running", listings_fetched: 4, listings_kept: 2 });

  // Only the kept listings are scored. They are still unscored on the second run, so they are queued again;
  // the scoring step itself skips a listing that already has a score.
  const keptIds = [saved?.[1].id, saved?.[3].id];
  const scoring = queued.splice(0);
  expect(scoring.map((step) => step.step)).toEqual(Array(4).fill("score_listing"));
  expect(new Set(scoring.map((step) => (step.payload as { listingId: string }).listingId))).toEqual(new Set(keptIds));
});

test("a source that failed every attempt is skipped, and the night goes on", async () => {
  const run = await database.from("runs").insert({ id: gaveUpRunId, kind: "daily" });
  if (run.error) throw run.error;

  await fetchingGaveUp({ runId: gaveUpRunId });
  expect(queued.splice(0)).toEqual([
    { step: "fetch_listings", payload: { runId: gaveUpRunId, source: "hackernews", readSoFar: 0 } },
  ]);

  // The last source giving up still finishes fetching: nothing was saved, so the run goes straight to its list.
  await fetchingGaveUp({ runId: gaveUpRunId, source: "hackernews", readSoFar: 0 });
  expect(queued.splice(0)).toEqual([{ step: "select_top_listings", payload: { runId: gaveUpRunId } }]);
});
