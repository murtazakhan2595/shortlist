import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { answerForm, checkFormAnswers, QUESTIONS_PER_STEP } from "@/features/forms/steps/answer-form";
import { readForm } from "@/features/forms/steps/read-form";
import { getAdminClient } from "@/server/supabase/admin";

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

  test("reads one page per step, each page once, and later pages add only new questions", async () => {
    const applicationId = await createForm();
    const firstPage = { inputType: "text" as const, pageId: randomUUID(), text: "Name\nDocker?" };
    const secondPage = { inputType: "text" as const, pageId: randomUUID(), text: "Docker?\nNotice period?" };
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

    await readForm({ applicationId, pages: [firstPage, secondPage] });
    await readForm({ applicationId, pages: [firstPage, secondPage] });

    expect(invokeModel).toHaveBeenCalledTimes(1);
    expect(queued).toEqual([
      { step: "read_form", payload: { applicationId, pages: [secondPage] } },
      { step: "read_form", payload: { applicationId, pages: [secondPage] } },
    ]);
    const { data: job } = await database.from("applications").select("job_role, job_company, job_text").eq("id", applicationId).single();
    expect(job).toEqual({ job_role: "Senior Full Stack Developer", job_company: "Acme", job_text: "On-site in Lahore, Monday to Friday." });

    // The second page overlaps the first, so the model lists the Docker question again.
    queued.length = 0;
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
    await readForm({ applicationId, pages: [secondPage] });

    expect(JSON.stringify(invokeModel.mock.calls[1][0])).toContain("1. Name *");
    expect(queued).toEqual([{ step: "answer_form", payload: { applicationId } }]);
    expect((await loadQuestions(applicationId)).map(({ position, question, status }) => ({ position, question, status }))).toEqual([
      { position: 1, question: "Name *", status: "pending" },
      { position: 2, question: "Do you have Docker experience?", status: "pending" },
      { position: 3, question: "Notice period?", status: "pending" },
    ]);
    const { data: jobAfter } = await database.from("applications").select("job_role").eq("id", applicationId).single();
    expect(jobAfter?.job_role).toBe("Senior Full Stack Developer");
  });

  test("a page with only the job post is read once, and the job's text is kept page after page", async () => {
    const applicationId = await createForm();
    const postPage = { inputType: "text" as const, pageId: randomUUID(), text: "We are hiring. On-site in Lahore." };
    const descriptionPage = { inputType: "text" as const, pageId: randomUUID(), text: "Requirements: Laravel." };
    invokeModel.mockResolvedValue(
      modelAnswer({ role: "Developer", company: "Acme", jobText: "We are hiring. On-site in Lahore.", questions: [] }),
    );

    await readForm({ applicationId, pages: [postPage] });
    await readForm({ applicationId, pages: [postPage] });
    invokeModel.mockResolvedValue(modelAnswer({ role: null, company: null, jobText: "Requirements: Laravel.", questions: [] }));
    await readForm({ applicationId, pages: [descriptionPage] });

    expect(invokeModel).toHaveBeenCalledTimes(2);
    const { data } = await database.from("applications").select("job_text, read_page_ids").eq("id", applicationId).single();
    expect(data).toEqual({
      job_text: "We are hiring. On-site in Lahore.\n\nRequirements: Laravel.",
      read_page_ids: [postPage.pageId, descriptionPage.pageId],
    });
  });

  test("answers once, checks once, sends unsupported answers to the owner, then marks the form ready", async () => {
    const applicationId = await createForm();
    const rows = [
      { position: 1, question: "Name", options: [] },
      { position: 2, question: "Laravel experience?", options: ["Yes", "No"] },
      { position: 3, question: "Spoken English out of 10?", options: [] },
      { position: 4, question: "Attach your CV", options: [] },
    ].map((row) => ({ ...row, application_id: applicationId, status: "pending" }));
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

    const { count } = await database.from("model_calls").select("id", { count: "exact", head: true }).eq("application_id", applicationId);
    expect(count).toBe(2);
  });

  test("a long form is answered and checked a batch of questions per step", async () => {
    const applicationId = await createForm();
    const total = QUESTIONS_PER_STEP + 2;
    const positions = Array.from({ length: total }, (_, index) => index + 1);
    const inserted = await database.from("form_answers").insert(
      positions.map((position) => ({ application_id: applicationId, position, question: `Question ${position}?`, status: "pending" })),
    );
    if (inserted.error) throw inserted.error;
    invokeModel.mockResolvedValue(
      modelAnswer({ answers: positions.map((position) => ({ position, status: "answered", answer: `Answer ${position}`, note: null })) }),
    );

    // The first run answers one batch and queues itself for the rest; the second answers the rest.
    await answerForm({ applicationId });
    expect(JSON.stringify(invokeModel.mock.calls[0][0])).toContain(`${QUESTIONS_PER_STEP}. Question ${QUESTIONS_PER_STEP}?`);
    expect(JSON.stringify(invokeModel.mock.calls[0][0])).not.toContain(`Question ${total}?`);
    await answerForm({ applicationId });
    expect(queued.map((step) => step.step)).toEqual(["answer_form", "check_form_answers"]);
    expect((await loadQuestions(applicationId)).every((question) => question.status === "checking")).toBe(true);

    queued.length = 0;
    invokeModel.mockReset();
    invokeModel.mockResolvedValue(modelAnswer({ problems: [] }));
    await checkFormAnswers({ applicationId });
    const { data: midway } = await database.from("applications").select("status").eq("id", applicationId).single();
    expect(midway?.status).toBe("preparing");
    await checkFormAnswers({ applicationId });

    expect(invokeModel).toHaveBeenCalledTimes(2);
    expect(queued.map((step) => step.step)).toEqual(["check_form_answers"]);
    const { data: form } = await database.from("applications").select("status").eq("id", applicationId).single();
    expect(form?.status).toBe("ready");
  });
});
