import type { z } from "zod";
import type { ModelSettings } from "@/server/models/chat-models";

// A quality check (REQUIREMENTS.md section 7): runs the real step on one test case and grades the answer.
// Test cases are private (they hold other people's details) and live in private/evals/<check id>/cases/.

export type Grade = { pass: boolean; reason: string };

export type EvalCheck<Case, Output> = {
  /** E1 to E5, as in REQUIREMENTS.md section 7. */
  id: string;
  name: string;
  /** The share of cases that must pass, from 0 to 1. */
  passBar: number;
  caseSchema: z.ZodType<Case>;
  // Written as methods, not arrow-function fields, so a check for specific cases can sit in the
  // registry of all checks (evals/checks.ts), typed as EvalCheck<unknown, unknown>.
  /** Runs the real step on one case with the given model, through callModel. */
  run(testCase: Case, model: ModelSettings, link: { runId: string }): Promise<Output>;
  grade(output: Output, testCase: Case): Grade;
};

export type CaseFailure = { caseId: string; reason: string };

export type ModelResult = {
  model: ModelSettings;
  passed: number;
  total: number;
  averageSeconds: number;
  costUsd: number;
  /** Shown in the terminal only; never written to the committed results, as reasons can quote case content. */
  failures: CaseFailure[];
};

export type EvalReport = {
  checkId: string;
  checkName: string;
  passBar: number;
  date: string;
  results: ModelResult[];
};
