import { MemorySaver } from "@langchain/langgraph";
import { beforeEach, expect, test, vi } from "vitest";
import { callModel } from "@/server/models/call-model";
import type { EmailDraft, WriterContext } from "../schemas";
import { buildWriterGraph, MAX_DRAFTS, START_STATE, writerOutcome } from "./writer";

// The loop's routes, with the model replaced: each step's answer comes from the fakes below,
// and the code check runs for real.
vi.mock("@/server/models/call-model", () => ({ callModel: vi.fn() }));

const writer: WriterContext = {
  route: "email",
  link: {},
  post: { text: "Hiring a React Developer. Email hr@acme.example", role: "React Developer", company: null, posterName: null, seenOn: "LinkedIn" },
  recipientEmail: "hr@acme.example",
  profile: "Three years with React.",
  answerBank: "Notice period: immediately.",
  writingGuide: "",
  voiceExamples: [],
  patterns: [{ id: "p1", name: "post-reply", content: "**Length:** 3–30 words" }],
  cvVariants: ["full_stack"],
};

const goodDraft: EmailDraft = {
  cvVariant: "full_stack",
  presentedTitle: "Full-Stack Developer",
  emailPattern: "post-reply",
  subject: "React Developer application",
  body: "Hi team, I have built with React for three years.",
  signature: "Regards,\nThe Owner",
};
const draftWithInventedNumber = { ...goodDraft, body: "Hi team, I have 9 years with React." };

/** Answers each model call by its step: drafts in order for a write step, problem lists for a check step. */
function fakeModel(drafts: EmailDraft[], reviews: string[][]) {
  vi.mocked(callModel).mockImplementation(async (request) => {
    const output = request.step === "write_email" || request.step === "write_note" ? drafts.shift() : { problems: (reviews.shift() ?? []).map((reason) => ({ quote: "q", reason })) };
    return { output, modelCallId: "call" } as Awaited<ReturnType<typeof callModel>>;
  });
}

function stepsCalled(step: string) {
  return vi.mocked(callModel).mock.calls.filter(([request]) => request.step === step);
}

function run(threadId: string, stepwise = false) {
  const graph = buildWriterGraph(new MemorySaver());
  const config = { configurable: { thread_id: threadId }, context: { writer, models: undefined } };
  return { graph, config: stepwise ? { ...config, interruptAfter: "*" as const } : config };
}

beforeEach(() => {
  vi.mocked(callModel).mockReset();
});

test("a draft that passes both checks is ready after one write", async () => {
  fakeModel([goodDraft], [[]]);
  const { graph, config } = run("pass");

  const state = await graph.invoke(START_STATE, config);

  expect(writerOutcome(state)).toBe("ready");
  expect(state.drafts).toBe(1);
});

test("a problem the code finds sends the draft back with the problem, before any model check", async () => {
  fakeModel([draftWithInventedNumber, goodDraft], [[]]);
  const { graph, config } = run("code-problem");

  const state = await graph.invoke(START_STATE, config);

  expect(writerOutcome(state)).toBe("ready");
  const [, secondWrite] = stepsCalled("write_email");
  expect(JSON.stringify(secondWrite[0].messages)).toContain("The number 9 does not appear in the profile");
  expect(stepsCalled("check_email")).toHaveLength(1);
});

test(`still unsupported after ${MAX_DRAFTS} drafts, the application is blocked with the problems`, async () => {
  fakeModel([goodDraft, goodDraft, goodDraft], [["the profile says two"], ["the profile says two"], ["the profile says two"]]);
  const { graph, config } = run("blocked");

  const state = await graph.invoke(START_STATE, config);

  expect(writerOutcome(state)).toBe("blocked");
  expect(state.drafts).toBe(MAX_DRAFTS);
  expect(state.problems).toEqual(['"q": the profile says two']);
});

test("paused after every stage, each call runs exactly one stage and the state is saved between them", async () => {
  fakeModel([goodDraft], [[]]);
  const { graph, config } = run("stepwise", true);
  const thread = { configurable: config.configurable };

  await graph.invoke(START_STATE, config);
  expect((await graph.getState(thread)).next).toEqual(["codeCheck"]);

  await graph.invoke(null, config);
  expect((await graph.getState(thread)).next).toEqual(["modelCheck"]);

  await graph.invoke(null, config);
  const done = await graph.getState(thread);
  expect(done.next).toEqual([]);
  expect(writerOutcome(done.values)).toBe("ready");
});

test("tells both calls where the post was seen, and caches the owner's material", async () => {
  fakeModel([goodDraft], [[]]);
  const { graph, config } = run("prompt");

  await graph.invoke(START_STATE, config);

  // Both calls are told, or the check flags "I saw it on LinkedIn" as unsupported.
  const [[write]] = stepsCalled("write_email");
  const [[check]] = stepsCalled("check_email");
  expect(JSON.stringify(write.messages)).toContain("saw this post on LinkedIn");
  expect(JSON.stringify(check.messages)).toContain("saw this post on LinkedIn");
  expect(write.messages[1]).toMatchObject({ role: "user", content: [{ type: "text", cache: true }] });
});

test("a note uses the note steps and pattern, and has no subject or signature", async () => {
  const noteDraft = { ...goodDraft, emailPattern: "job-board-note", subject: "Not wanted", signature: "Not wanted" };
  fakeModel([noteDraft], [[]]);
  const noteWriter: WriterContext = {
    ...writer,
    route: "note",
    recipientEmail: null,
    patterns: [{ id: "p2", name: "job-board-note", content: "**Length:** 3–30 words" }],
  };
  const graph = buildWriterGraph(new MemorySaver());

  const state = await graph.invoke(START_STATE, {
    configurable: { thread_id: "note" },
    context: { writer: noteWriter, models: undefined },
  });

  expect(writerOutcome(state)).toBe("ready");
  expect(state.draft).toMatchObject({ subject: "", signature: "", body: goodDraft.body });
  expect(stepsCalled("write_email")).toHaveLength(0);
  const [[write]] = stepsCalled("write_note");
  expect(stepsCalled("check_note")).toHaveLength(1);
  expect(JSON.stringify(write.messages)).toContain("No links, no greeting and no sign-off");
});

