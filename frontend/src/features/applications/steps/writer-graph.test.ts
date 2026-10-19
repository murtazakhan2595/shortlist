import { MemorySaver } from "@langchain/langgraph";
import { beforeEach, expect, test, vi } from "vitest";
import { checkEmail } from "./check-email";
import type { EmailDraft } from "./draft-checks";
import { writeEmail } from "./write-email";
import { buildWriterGraph, MAX_DRAFTS, START_STATE, writerOutcome } from "./writer-graph";
import type { WriterContext } from "./writer-context";

// The loop's routes, with both model stages replaced: the code check runs for real.
vi.mock("./write-email", () => ({ writeEmail: vi.fn() }));
vi.mock("./check-email", () => ({ checkEmail: vi.fn() }));

const writer: WriterContext = {
  link: {},
  post: { text: "Hiring a React Developer. Email hr@acme.example", role: "React Developer", company: null, posterName: null },
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

function run(threadId: string, stepwise = false) {
  const graph = buildWriterGraph(new MemorySaver());
  const config = { configurable: { thread_id: threadId }, context: { writer, models: undefined } };
  return { graph, config: stepwise ? { ...config, interruptAfter: "*" as const } : config };
}

beforeEach(() => {
  vi.mocked(writeEmail).mockReset();
  vi.mocked(checkEmail).mockReset();
});

test("a draft that passes both checks is ready after one write", async () => {
  vi.mocked(writeEmail).mockResolvedValue(goodDraft);
  vi.mocked(checkEmail).mockResolvedValue([]);
  const { graph, config } = run("pass");

  const state = await graph.invoke(START_STATE, config);

  expect(writerOutcome(state)).toBe("ready");
  expect(state.drafts).toBe(1);
});

test("a problem the code finds sends the draft back, with the problem, before any model check", async () => {
  vi.mocked(writeEmail).mockResolvedValueOnce(draftWithInventedNumber).mockResolvedValueOnce(goodDraft);
  vi.mocked(checkEmail).mockResolvedValue([]);
  const { graph, config } = run("code-problem");

  const state = await graph.invoke(START_STATE, config);

  expect(writerOutcome(state)).toBe("ready");
  expect(vi.mocked(writeEmail).mock.calls[1][1]).toEqual({
    draft: draftWithInventedNumber,
    problems: ["The number 9 does not appear in the profile, the answer bank or the post."],
  });
  expect(checkEmail).toHaveBeenCalledTimes(1);
});

test(`still unsupported after ${MAX_DRAFTS} drafts, the application is blocked with the problems`, async () => {
  vi.mocked(writeEmail).mockResolvedValue(goodDraft);
  vi.mocked(checkEmail).mockResolvedValue(['"three years": the profile says two']);
  const { graph, config } = run("blocked");

  const state = await graph.invoke(START_STATE, config);

  expect(writerOutcome(state)).toBe("blocked");
  expect(state.drafts).toBe(MAX_DRAFTS);
  expect(state.problems).toEqual(['"three years": the profile says two']);
});

test("paused after every stage, each call runs exactly one stage and the state is saved between them", async () => {
  vi.mocked(writeEmail).mockResolvedValue(goodDraft);
  vi.mocked(checkEmail).mockResolvedValue([]);
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
