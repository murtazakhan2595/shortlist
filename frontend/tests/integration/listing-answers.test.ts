import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { draftListingAnswers } from "@/features/forms/actions";
import { readListingForm } from "@/features/forms/steps/read-form";
import { fetchGreenhouseQuestions } from "@/server/greenhouse";
import { getAdminClient } from "@/server/supabase/admin";

vi.mock("@/server/auth/require-owner", async () => {
  const { getAdminClient: admin } = await import("@/server/supabase/admin");
  return { requireOwner: async () => ({ db: admin() }) };
});
vi.mock("@/server/greenhouse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/greenhouse")>()),
  fetchGreenhouseQuestions: vi.fn(),
}));
const readQuestions = vi.mocked(fetchGreenhouseQuestions);

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => queued.push({ step, payload }),
}));

const database = getAdminClient();
const company = `Integration Test ${randomUUID()}`;

beforeEach(() => {
  queued.length = 0;
  readQuestions.mockReset();
});

afterAll(async () => {
  const { data } = await database.from("listings").select("id").eq("company", company);
  const listingIds = (data ?? []).map((listing) => listing.id);
  await database.from("applications").delete().in("listing_id", listingIds);
  await database.from("listings").delete().in("id", listingIds);
});

async function listing(source: string, title: string) {
  const id = randomUUID();
  const { error } = await database.from("listings").insert({
    id,
    source,
    source_id: `acme/${Math.floor(Math.random() * 1e9)}`,
    url: "https://example.com/jobs/1",
    title,
    company,
    eligibility: "eligible",
    fingerprint: `test_${id}`,
    description: "Build our API.",
  });
  if (error) throw error;
  return id;
}

async function questionsOf(applicationId: string) {
  const { data } = await database
    .from("form_answers")
    .select("position, question, options, status")
    .eq("application_id", applicationId)
    .order("position");
  return data;
}

test("a Greenhouse job's questions are read once, with no model, and answering is queued", async () => {
  const listingId = await listing("greenhouse", "Backend Engineer");
  readQuestions.mockResolvedValue([
    { label: "First Name", required: true, description: null, fields: [{ type: "input_text", values: [] }] },
    { label: "Do you need a visa?", required: false, description: null, fields: [{ type: "multi_value_single_select", values: [{ label: "Yes" }, { label: "No" }] }] },
  ]);

  // Asking twice gives the same form.
  const first = await draftListingAnswers({ listingId });
  const second = await draftListingAnswers({ listingId });
  if (!first.ok) throw new Error(first.error.message);
  expect(second).toEqual(first);
  const applicationId = first.data.applicationId;
  expect(queued.splice(0)).toEqual([{ step: "read_listing_form", payload: { applicationId } }]);

  const { data: form } = await database.from("applications").select("route, status, job_role, job_company, job_text").eq("id", applicationId).single();
  expect(form).toEqual({ route: "form", status: "preparing", job_role: "Backend Engineer", job_company: company, job_text: "Build our API." });

  await readListingForm({ applicationId });
  await readListingForm({ applicationId });

  expect(readQuestions).toHaveBeenCalledTimes(1);
  expect(await questionsOf(applicationId)).toEqual([
    { position: 1, question: "First Name *", options: [], status: "pending" },
    { position: 2, question: "Do you need a visa?", options: ["Yes", "No"], status: "pending" },
  ]);
  expect(queued).toEqual([
    { step: "answer_form", payload: { applicationId } },
    { step: "answer_form", payload: { applicationId } },
  ]);
});

test("a job that closed before its questions were read is marked, and nothing is answered", async () => {
  const listingId = await listing("greenhouse", "Frontend Engineer");
  readQuestions.mockResolvedValue(null);
  const started = await draftListingAnswers({ listingId });
  if (!started.ok) throw new Error(started.error.message);
  queued.length = 0;

  await readListingForm({ applicationId: started.data.applicationId });

  const { data: form } = await database.from("applications").select("status, blocked_reason").eq("id", started.data.applicationId).single();
  expect(form).toEqual({ status: "blocked", blocked_reason: "The job has closed on Greenhouse." });
  expect(queued).toEqual([]);
});

test("a job from a source that publishes no questions is refused", async () => {
  const listingId = await listing("himalayas", "Data Engineer");

  expect(await draftListingAnswers({ listingId })).toEqual({
    ok: false,
    error: { code: "invalid_input", message: "Only Greenhouse jobs publish their questions." },
  });
  expect(queued).toEqual([]);
});
