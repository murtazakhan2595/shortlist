import "server-only";
import { Annotation, type BaseCheckpointSaver, END, type Runtime, START, StateGraph } from "@langchain/langgraph";
import type { ModelSettings } from "@/server/models/chat-models";
import { checkEmail } from "./check-email";
import { type EmailDraft, findDraftProblems } from "./draft-checks";
import { writeEmail } from "./write-email";
import type { WriterContext } from "./writer-context";

// The writer's loop (PLAN.md item 2.2), as a LangGraph graph:
//
//   write -> code check -> model check -> done
//     ^          |             |
//     +----------+-------------+   problems, and fewer than MAX_DRAFTS drafts so far
//
// The graph decides only the route; each stage is ordinary code or one model call. Problems after
// MAX_DRAFTS drafts block the application, with the problems as the reason (X4).

export const MAX_DRAFTS = 3;

export const WriterState = Annotation.Root({
  draft: Annotation<EmailDraft | null>,
  /** What the last check found. Empty after a check that passed. */
  problems: Annotation<string[]>,
  /** How many drafts have been written. */
  drafts: Annotation<number>,
});
export type WriterStateValues = typeof WriterState.State;

export const START_STATE: WriterStateValues = { draft: null, problems: [], drafts: 0 };

/** What each run is given from outside the saved state: the material, and optionally other models (evals). */
const WriterRunContext = Annotation.Root({
  writer: Annotation<WriterContext>,
  models: Annotation<{ write?: ModelSettings; check?: ModelSettings } | undefined>,
});
export type WriterRunContext = typeof WriterRunContext.State;

type WriterRuntime = Runtime<WriterRunContext>;

function contextOf(runtime: WriterRuntime): WriterRunContext {
  if (!runtime.context) throw new Error("The writer graph was run without its context");
  return runtime.context;
}

function requireDraft(state: WriterStateValues): EmailDraft {
  if (!state.draft) throw new Error("The writer reached a check without a draft");
  return state.draft;
}

async function write(state: WriterStateValues, runtime: WriterRuntime) {
  const { writer, models } = contextOf(runtime);
  const revision = state.draft ? { draft: state.draft, problems: state.problems } : undefined;
  const draft = await writeEmail(writer, revision, models?.write);
  return { draft, problems: [], drafts: state.drafts + 1 };
}

function codeCheck(state: WriterStateValues, runtime: WriterRuntime) {
  const { writer } = contextOf(runtime);
  const draft = requireDraft(state);
  const pattern = writer.patterns.find((candidate) => candidate.name === draft.emailPattern);
  const problems = findDraftProblems(draft, {
    profile: writer.profile,
    answerBank: writer.answerBank,
    postText: writer.post.text,
    postRole: writer.post.role,
    patternContent: pattern?.content ?? "",
  });
  return { problems };
}

async function modelCheck(state: WriterStateValues, runtime: WriterRuntime) {
  const { writer, models } = contextOf(runtime);
  return { problems: await checkEmail(writer, requireDraft(state), models?.check) };
}

/** After a check: on to the next stage if it passed, back to writing if a draft is left, else stop. */
function routeAfter(next: "modelCheck" | typeof END) {
  return (state: WriterStateValues) => {
    if (state.problems.length === 0) return next;
    return state.drafts < MAX_DRAFTS ? "write" : END;
  };
}

/** A finished run is ready when its last check found nothing; otherwise it is blocked. */
export function writerOutcome(state: WriterStateValues): "ready" | "blocked" {
  return state.draft && state.problems.length === 0 ? "ready" : "blocked";
}

export function buildWriterGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(WriterState, WriterRunContext)
    .addNode("write", write)
    .addNode("codeCheck", codeCheck)
    .addNode("modelCheck", modelCheck)
    .addEdge(START, "write")
    .addEdge("write", "codeCheck")
    .addConditionalEdges("codeCheck", routeAfter("modelCheck"), ["modelCheck", "write", END])
    .addConditionalEdges("modelCheck", routeAfter(END), ["write", END])
    .compile({ checkpointer });
}
