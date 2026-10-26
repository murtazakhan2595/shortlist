import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { getRecentApplications } from "@/features/applications/data";
import { getOpenFailures } from "@/features/failed-steps/data";
import { getAdminClient } from "@/server/supabase/admin";
import { TEST_RUN_STARTED_AT } from "./test-runs";

// Tests never sign in as the owner, so the owner check is replaced by the admin client.
vi.mock("@/server/auth/require-owner", async () => {
  const { getAdminClient: admin } = await import("@/server/supabase/admin");
  return { requireOwner: async () => ({ db: admin() }) };
});

const database = getAdminClient();
const tag = randomUUID();
const ids = { capture: "", email: "", form: "", listing: "", note: "", run: randomUUID() };

beforeAll(async () => {
  const capture = await database.from("captures").insert({ input_type: "text", raw_text: "test", role: "Daily List Engineer", company: "Acme", status: "done" }).select("id").single();
  if (capture.error) throw capture.error;
  ids.capture = capture.data.id;

  const run = await database.from("runs").insert({ id: ids.run, kind: "daily", started_at: TEST_RUN_STARTED_AT });
  if (run.error) throw run.error;
  const listing = await database
    .from("listings")
    .insert({ source: "himalayas", source_id: tag, url: "https://example.com", title: "Note Engineer", company: "Beta", description: "x", eligibility: "eligible", fingerprint: `daily-${tag}`, tags: ["remote"], run_id: ids.run })
    .select("id")
    .single();
  if (listing.error) throw listing.error;
  ids.listing = listing.data.id;
  const score = await database.from("scores").insert({ listing_id: ids.listing, score: 77, reasons: "x" });
  if (score.error) throw score.error;

  const applications = await database
    .from("applications")
    .insert([
      { capture_id: ids.capture, route: "email", status: "ready", fingerprint: `daily-email-${tag}`, gmail_draft_id: "draft-1" },
      { listing_id: ids.listing, route: "note", status: "ready", fingerprint: `daily-note-${tag}` },
      { route: "form", status: "preparing", fingerprint: `daily-form-${tag}`, job_role: "Form Engineer", job_company: "Gamma" },
    ])
    .select("id, route");
  if (applications.error) throw applications.error;
  for (const row of applications.data) ids[row.route as "email" | "note" | "form"] = row.id;

  const failures = await database.from("failed_steps").insert([
    { queue: "steps", message_id: 0, step: "create_gmail_draft", payload: { applicationId: ids.email }, attempts: 3, error: tag },
    { queue: "steps", message_id: 0, step: "read_form", payload: { applicationId: ids.form, pages: [] }, attempts: 3, error: tag },
    { queue: "steps", message_id: 0, step: "extract_capture", payload: { captureId: ids.capture }, attempts: 3, error: tag },
    { queue: "steps", message_id: 0, step: "score_listing", payload: { listingId: ids.listing }, attempts: 3, error: tag },
  ]);
  if (failures.error) throw failures.error;
});

afterAll(async () => {
  await database.from("failed_steps").delete().eq("error", tag);
  await database.from("applications").delete().in("id", [ids.email, ids.note, ids.form]);
  await database.from("scores").delete().eq("listing_id", ids.listing);
  await database.from("listings").delete().eq("id", ids.listing);
  await database.from("runs").delete().eq("id", ids.run);
  await database.from("captures").delete().eq("id", ids.capture);
});

test("the daily list names each application's job, source and what was prepared, with a link to it", async () => {
  const applications = await getRecentApplications();
  const byId = new Map(applications.map((application) => [application.id, application]));

  expect(byId.get(ids.email)).toMatchObject({ route: "email", role: "Daily List Engineer", company: "Acme", source: "LinkedIn", inGmail: true, href: `/captures/${ids.capture}` });
  expect(byId.get(ids.note)).toMatchObject({ route: "note", role: "Note Engineer", source: "Himalayas", score: 77, tags: ["remote"], href: "/jobs" });
  expect(byId.get(ids.form)).toMatchObject({ route: "form", role: "Form Engineer", company: "Gamma", source: null, status: "preparing", href: `/forms/${ids.form}` });
});

test("each open failure links to the page of what it was working on", async () => {
  const failures = (await getOpenFailures()).filter((failure) => failure.error === tag);
  const pageOf = Object.fromEntries(failures.map((failure) => [failure.step, failure.href]));

  expect(pageOf).toEqual({
    create_gmail_draft: `/captures/${ids.capture}`,
    read_form: `/forms/${ids.form}`,
    extract_capture: `/captures/${ids.capture}`,
    score_listing: "/jobs",
  });
});
