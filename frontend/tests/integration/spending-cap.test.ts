import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { advanceWriter, prepareListingApplication, STOPPED_AT_CAP } from "@/features/applications/steps/writer-steps";
import { fetchListings } from "@/features/discovery/steps/fetch-listings";
import { scoreListing, selectTopListings } from "@/features/discovery/steps/score-listings";
import { fetchHimalayasJobs } from "@/server/himalayas";
import { getAdminClient } from "@/server/supabase/admin";

// The nightly run at the monthly spending cap (B2), against the real database. The cap is faked as
// reached, so the owner's real settings are never changed. No model or Himalayas call may happen.
vi.mock("@/server/spending", () => ({ loadSpendingCap: async () => ({ spentUsd: 50.5, capUsd: 50, reached: true }) }));

const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({ createStructuredModel: () => ({ invoke: invokeModel }) }));
vi.mock("@/server/himalayas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/himalayas")>()),
  fetchHimalayasJobs: vi.fn(async () => []),
}));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
  wakeWorker: async () => {},
}));

const database = getAdminClient();
const runIds: string[] = [];

beforeEach(() => {
  queued.length = 0;
  invokeModel.mockReset();
});

afterAll(async () => {
  for (const runId of runIds) {
    const listings = await database.from("listings").select("id").eq("run_id", runId);
    const listingIds = (listings.data ?? []).map((listing) => listing.id);
    await database.from("applications").delete().in("listing_id", listingIds);
    await database.from("listings").delete().eq("run_id", runId);
    await database.from("runs").delete().eq("id", runId);
  }
});

async function addRun(): Promise<string> {
  const { data, error } = await database.from("runs").insert({ kind: "daily" }).select("id").single();
  if (error) throw error;
  runIds.push(data.id);
  return data.id;
}

async function addListing(runId: string, name: string, topRank: number | null = null, contactEmail: string | null = null): Promise<string> {
  const { data, error } = await database
    .from("listings")
    .insert({
      source: "test",
      source_id: `${name}-${runId}`,
      url: "https://example.com/job",
      title: `${name} engineer`,
      company: `Cap Test ${runId}`,
      description: "Build web apps.",
      eligibility: "eligible",
      fingerprint: `cap-${name}-${runId}`,
      run_id: runId,
      top_rank: topRank,
      contact_email: contactEmail,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function runStatus(runId: string) {
  const { data } = await database.from("runs").select("status").eq("id", runId).single();
  return data?.status;
}

test("at the cap, the night's fetch reads nothing and finishes the run", async () => {
  const runId = await addRun();

  await fetchListings({ runId });

  expect(fetchHimalayasJobs).not.toHaveBeenCalled();
  expect(queued).toEqual([]);
  expect(await runStatus(runId)).toBe("succeeded");
});

test("at the cap, a listing is not scored, and the run goes on to choose from those already scored", async () => {
  const runId = await addRun();
  const listingId = await addListing(runId, "unscored");

  await scoreListing({ listingId });

  expect(invokeModel).not.toHaveBeenCalled();
  expect(queued).toEqual([{ step: "select_top_listings", payload: { runId } }]);
});

test("at the cap, the list is still chosen, but no emails are queued", async () => {
  const runId = await addRun();
  const listingId = await addListing(runId, "scored", null, "jobs@acme.example");
  const score = await database.from("scores").insert({ listing_id: listingId, score: 80, reasons: "test" });
  if (score.error) throw score.error;

  await selectTopListings({ runId });

  const { data } = await database.from("listings").select("top_rank").eq("id", listingId).single();
  expect(data?.top_rank).toBe(1);
  expect(queued).toEqual([]);
  expect(await runStatus(runId)).toBe("succeeded");
  await database.from("scores").delete().eq("listing_id", listingId);
});

test("at the cap, a listing's email already queued is stopped without a model call, saying why", async () => {
  const runId = await addRun();
  const listingId = await addListing(runId, "top", 1, "jobs@acme.example");

  await prepareListingApplication({ listingId });
  const [{ payload }] = queued;
  const { applicationId } = payload as { applicationId: string };
  await advanceWriter({ applicationId });

  expect(invokeModel).not.toHaveBeenCalled();
  const { data } = await database.from("applications").select("status, blocked_reason").eq("id", applicationId).single();
  expect(data).toEqual({ status: "blocked", blocked_reason: STOPPED_AT_CAP });
});
