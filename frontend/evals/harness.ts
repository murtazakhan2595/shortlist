import { describeError } from "@/lib/errors";
import type { ModelSettings } from "@/server/models/chat-models";
import type { LoadedCase } from "./cases";
import type { CaseFailure, EvalCheck, ModelResult } from "./check";

// Runs every case of a check against each model and counts the passes (PLAN.md item 1.6).
// Costs are added afterwards from model_calls, by the eval run they are linked to.

// A few cases at a time, so a run is quick without hitting the provider's rate limits.
const MAX_CONCURRENT_CASES = 4;

export type PassCounts = Omit<ModelResult, "costUsd">;

type CaseResult = { caseId: string; pass: boolean; reason: string; seconds: number };

export async function runEval<Case, Output>(
  check: EvalCheck<Case, Output>,
  cases: LoadedCase<Case>[],
  models: ModelSettings[],
  link: { runId: string },
): Promise<PassCounts[]> {
  const counts: PassCounts[] = [];
  for (const model of models) {
    const results = await mapConcurrently(cases, MAX_CONCURRENT_CASES, (loaded) => runCase(check, loaded, model, link));
    counts.push(countPasses(model, results));
  }
  return counts;
}

async function runCase<Case, Output>(
  check: EvalCheck<Case, Output>,
  { id, testCase }: LoadedCase<Case>,
  model: ModelSettings,
  link: { runId: string },
): Promise<CaseResult> {
  const startedAt = performance.now();
  try {
    const grade = check.grade(await check.run(testCase, model, link), testCase);
    return { caseId: id, ...grade, seconds: secondsSince(startedAt) };
  } catch (error) {
    // A step that fails counts as a failed case, with its error as the reason.
    return { caseId: id, pass: false, reason: describeError(error), seconds: secondsSince(startedAt) };
  }
}

function countPasses(model: ModelSettings, results: CaseResult[]): PassCounts {
  const failures: CaseFailure[] = results
    .filter((result) => !result.pass)
    .map(({ caseId, reason }) => ({ caseId, reason }));
  const totalSeconds = results.reduce((sum, result) => sum + result.seconds, 0);

  return {
    model,
    passed: results.length - failures.length,
    total: results.length,
    averageSeconds: results.length === 0 ? 0 : totalSeconds / results.length,
    failures,
  };
}

function secondsSince(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}

/** Like Promise.all over items.map(work), but with at most `limit` running at once. Keeps the input order. */
async function mapConcurrently<Item, Result>(
  items: Item[],
  limit: number,
  work: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
