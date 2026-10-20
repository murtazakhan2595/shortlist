import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { answerForm, checkFormAnswers } from "@/features/forms/steps/answer-form";
import { readForm } from "@/features/forms/steps/read-form";
import { getAdminClient } from "@/server/supabase/admin";

// The form's queued steps against the real database and the owner's real material, with a fake model.
// Queued steps are collected here instead of going to the real queue.
const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({ createStructuredModel: () => ({ invoke: invokeModel }) }));

const queued = vi.hoisted((): { step: string; payload: unknown }[] => []);
vi.mock("@/server/queue/queue", () => ({
  enqueueStep: async (step: string, payload: unknown) => {
    queued.push({ step, payload });
    return queued.length;
  },
}));

function modelAnswer(parsed: unknown) {
  const raw = new AIMessage({
    content: JSON.stringify(parsed),
    usage_metadata: { input_tokens: 2_000, output_tokens: 200, total_tokens: 2_200 },
  });
  return { raw, parsed };
}

const textPages = (text: string) => ({ inputType: "text" as const, text });

describe("the form's queued steps", () => {
  const database = getAdminClient();
  const applicationIds: string[] = [];

  beforeEach(() => {
    invokeModel.mockReset();
    queued.length = 0;
  });

  afterAll(async () => {
    await database.from("model_calls").delete().in("application_id", applicationIds);
    await database.from("applications").delete().in("id", applicationIds);
  });

  async function createForm() {
    const id = randomUUID();
    const { error } = await database.from("applications").insert({ id, route: "form", fingerprint: `form:${id}` });
    if (error) throw error;
    applicationIds.push(id);
    return id;
  }

  async function loadQuestions(applicationId: string) {
    const { data, error } = await database
      .from("form_answers")
      .select("position, question, options, status, answer, note")
      .eq("application_id", applicationId)
      .order("position");
    if (error) throw error;
    return data;
  }

  test("reads each batch of pages once, and later pages add only new questions", async () => {
    const applicationId = await createForm();
    invokeModel.mockResolvedValue(
      modelAnswer({
        role: "Senior Full Stack Developer",
        company: "Acme",
        jobText: "On-site in Lahore, Monday to Friday.",
        questions: [
          { question: "Name *", options: [] },
          { question: "Do you have Docker experience?", options: ["Yes", "No"] },
        ],
      }),
    );

    const firstBatch = { applicationId, batchId: randomUUID(), pages: textPages("Name\nDocker?") };
    await readForm(firstBatch);
    await readForm(firstBatch);

    expect(invokeModel).toHaveBeenCalledTimes(1);
    expect(queued).toEqual([
      { step: "answer_form", payload: { applicationId } },
      { step: "answer_form", payload: { applicationId } },
    ]);
    const { data: job } = await database.from("applications").select("job_role, job_company, job_text").eq("id", applicationId).single();
    expect(job).toEqual({ job_role: "Senior Full Stack Developer", job_company: "Acme", job_text: "On-site in Lahore, Monday to Friday." });

    // The next screenshot overlaps the last one, so the model lists the Docker question again.
    invokeModel.mockResolvedValue(
      modelAnswer({
        role: "Other role",
        company: null,
        jobText: null,
        questions: [
          { question: "Do you have Docker experience?", options: ["Yes", "No"] },
          { question: "Notice period?", options: [] },
        ],
      }),
    );
    await readForm({ applicationId, batchId: randomUUID(), pages: textPages("Docker?\nNotice period?") });

    // The model was told what earlier pages gave.
    expect(JSON.stringify(invokeModel.mock.calls[1][0])).toContain("1. Name *");
    expect((await loadQuestions(applicationId)).map(({ position, question, status }) => ({ position, question, status }))).toEqual([
      { position: 1, question: "Name *", status: "pending" },
      { position: 2, question: "Do you have Docker experience?", status: "pending" },
      { position: 3, question: "Notice period?", status: "pending" },
    ]);
    // The job stays as first read.
    const { data: jobAfter } = await database.from("applications").select("job_role").eq("id", applicationId).single();
    expect(jobAfter?.job_role).toBe("Senior Full Stack Developer");
  });

  test("answers once, checks once, sends unsupported answers to the owner, then marks the form ready", async () => {
    const applicationId = await createForm();
    const batch_id = randomUUID();
    const rows = [
      { position: 1, question: "Name", options: [] },
      { position: 2, question: "Laravel experience?", options: ["Yes", "No"] },
      { position: 3, question: "Spoken English out of 10?", options: [] },
      { position: 4, question: "Attach your CV", options: [] },
    ].map((row) => ({ ...row, application_id: applicationId, batch_id, status: "pending" }));
    const inserted = await database.from("form_answers").insert(rows);
    if (inserted.error) throw inserted.error;

    invokeModel.mockResolvedValue(
      modelAnswer({
        answers: [
          { position: 1, status: "answered", answer: "Sam Khan", note: null },
          { position: 2, status: "answered", answer: "Yes", note: null },
          { position: 3, status: "needs_input", answer: null, note: "No number is stored." },
          { position: 4, status: "asset_needed", answer: "full_stack CV", note: "Upload your CV." },
        ],
      }),
    );
    await answerForm({ applicationId });
    await answerForm({ applicationId });

    expect(invokeModel).toHaveBeenCalledTimes(1);
    expect((await loadQuestions(applicationId)).map((question) => question.status)).toEqual([
      "checking",
      "checking",
      "needs_input",
      "asset_needed",
    ]);
    expect(queued.map((step) => step.step)).toEqual(["check_form_answers", "check_form_answers"]);

    invokeModel.mockReset();
    invokeModel.mockResolvedValue(modelAnswer({ problems: [{ position: 2, reason: "The profile shows no Laravel work." }] }));
    await checkFormAnswers({ applicationId });
    await checkFormAnswers({ applicationId });

    expect(invokeModel).toHaveBeenCalledTimes(1);
    expect(await loadQuestions(applicationId)).toMatchObject([
      { status: "answered", answer: "Sam Khan" },
      { status: "needs_input", answer: null, note: "The suggested answer was not supported: The profile shows no Laravel work." },
      { status: "needs_input", note: "No number is stored." },
      { status: "asset_needed", answer: "full_stack CV" },
    ]);
    const { data: form } = await database.from("applications").select("status").eq("id", applicationId).single();
    expect(form?.status).toBe("ready");

    // Every call is costed against the form (B1).
    const { count } = await database.from("model_calls").select("id", { count: "exact", head: true }).eq("application_id", applicationId);
    expect(count).toBe(2);
  });
});
