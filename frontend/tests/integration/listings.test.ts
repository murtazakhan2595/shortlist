import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { deleteExpiredListings, himalayasListing, saveNewListings } from "@/features/discovery/steps/fetch-listings";
import type { HimalayasJob } from "@/server/himalayas";
import { getAdminClient } from "@/server/supabase/admin";

// Saving converted listings through save_new_listings against the real database. The SQL rules themselves
// are tested in supabase/tests/database/listings.test.sql; this checks the app's rows arrive whole.
const database = getAdminClient();
const runId = randomUUID();
const company = `Integration Test ${randomUUID()}`;

afterAll(async () => {
  await database.from("listings").delete().eq("company", company);
  await database.from("runs").delete().eq("id", runId);
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
