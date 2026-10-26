import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { getReplyRates, getRunCosts } from "@/features/reports/data";
import { getAdminClient } from "@/server/supabase/admin";

// Tests never sign in as the owner, so the owner check is replaced by the admin client.
vi.mock("@/server/auth/require-owner", async () => {
  const { getAdminClient: admin } = await import("@/server/supabase/admin");
  return { requireOwner: async () => ({ db: admin() }) };
});

const database = getAdminClient();
const tag = randomUUID();
const runId = randomUUID();
let listingId = "";
const applicationIds: string[] = [];

beforeAll(async () => {
  // Among the two weeks of runs the report shows, but just before the latest real one, so the app never
  // takes it for the latest (test-runs.ts).
  const latest = await database.from("runs").select("started_at").eq("kind", "daily").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const startedAt = new Date(new Date(latest.data?.started_at ?? Date.now()).getTime() - 60_000).toISOString();
  const run = await database
    .from("runs")
    .insert({ id: runId, kind: "daily", started_at: startedAt, listings_fetched: 30, listings_kept: 9, listings_scored: 8 });
  if (run.error) throw run.error;
  const listing = await database
    .from("listings")
    .insert({ source: "test-reports", source_id: tag, url: "https://example.com", title: "Reports Engineer", company: "Acme", description: "x", eligibility: "eligible", fingerprint: `reports-${tag}`, run_id: runId, top_rank: 1 })
    .select("id")
    .single();
  if (listing.error) throw listing.error;
  listingId = listing.data.id;
  const call = await database.from("model_calls").insert({ run_id: runId, step: "score_listing", provider: "openai", model: "gpt-6-luna", cost_usd: 0.25 });
  if (call.error) throw call.error;

  const sentAt = new Date().toISOString();
  const applications = await database
    .from("applications")
    .insert([
      { listing_id: listingId, route: "note", status: "interview", sent_at: sentAt, fingerprint: `reports-note-${tag}` },
      { route: "form", status: "skipped", sent_at: sentAt, fingerprint: `reports-skipped-${tag}` },
    ])
    .select("id");
  if (applications.error) throw applications.error;
  applicationIds.push(...applications.data.map((row) => row.id));
});

afterAll(async () => {
  await database.from("applications").delete().in("id", applicationIds);
  await database.from("model_calls").delete().eq("run_id", runId);
  await database.from("listings").delete().eq("id", listingId);
  await database.from("runs").delete().eq("id", runId);
});

test("each nightly run shows its counts, how many made the list, and its model cost", async () => {
  const run = (await getRunCosts()).find((candidate) => candidate.id === runId);

  expect(run).toMatchObject({ fetched: 30, kept: 9, scored: 8, onList: 1, costUsd: 0.25 });
});

test("a sent application counts towards its source; one skipped after sending does not", async () => {
  const { bySource } = await getReplyRates();

  const source = bySource.find((rate) => rate.name === "test-reports");
  expect(source).toEqual({ name: "test-reports", sent: 1, replied: 1, interviews: 1 });
});
