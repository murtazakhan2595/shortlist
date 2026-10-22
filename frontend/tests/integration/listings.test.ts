import { randomUUID } from "node:crypto";
import { afterAll, expect, test, vi } from "vitest";
import {
  deleteExpiredListings,
  fetchListings,
  himalayasListing,
  saveNewListings,
} from "@/features/discovery/steps/fetch-listings";
import type { HimalayasJob } from "@/server/himalayas";
import { getAdminClient } from "@/server/supabase/admin";

// The daily run's first step against the real database, with Himalayas replaced by a fake. The SQL rules
// themselves are tested in supabase/tests/database/listings.test.sql; this checks the app's rows arrive whole.
const himalayasJobs = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock("@/server/himalayas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/himalayas")>()),
  fetchHimalayasJobs: vi.fn(async () => himalayasJobs.value),
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
const company = `Integration Test ${randomUUID()}`;

afterAll(async () => {
  await database.from("listings").delete().eq("company", company);
  await database.from("runs").delete().in("id", [runId, stepRunId]);
});

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

  expect(await deleteExpiredListings()).toBeGreaterThanOrEqual(1);
  const { data: left } = await database.from("listings").select("title").eq("company", company);
  expect(left).toEqual([{ title: "Engineer open" }]);
});

test("the daily run's first step saves the night's listings with the filter's decisions, once, and queues the kept ones to be scored", async () => {
  const run = await database.from("runs").insert({ id: stepRunId, kind: "daily" });
  if (run.error) throw run.error;
  const salesJob = { ...job("sales", null), title: "Account Manager", parentCategories: ["Sales"] };
  himalayasJobs.value = [job("developer", null), salesJob];

  await fetchListings({ runId: stepRunId });
  await fetchListings({ runId: stepRunId });

  const { data: saved } = await database
    .from("listings")
    .select("id, title, eligibility, eligibility_reason")
    .eq("run_id", stepRunId)
    .order("title");
  expect(saved).toEqual([
    { id: expect.any(String), title: "Account Manager", eligibility: "excluded", eligibility_reason: "Not a technical role" },
    { id: expect.any(String), title: "Engineer developer", eligibility: "eligible", eligibility_reason: null },
  ]);
  const { data: counted } = await database.from("runs").select("status, listings_fetched, listings_kept").eq("id", stepRunId).single();
  expect(counted).toEqual({ status: "running", listings_fetched: 2, listings_kept: 1 });

  // Only the kept listing is scored. It is still unscored on the second run, so it is queued again; the
  // scoring step itself skips a listing that already has a score.
  const developerId = saved?.[1].id;
  expect(queued).toEqual([
    { step: "score_listing", payload: { listingId: developerId } },
    { step: "score_listing", payload: { listingId: developerId } },
  ]);
});
