// Runs a quality check against one or more models and writes its results table (PLAN.md item 1.6).
//
//   pnpm eval E1 --models gpt-6.1-sol@low,gpt-6-luna@low
//
// Cases come from private/evals/<check>/cases/. The table is written to evals/results/<check>.md.
// Every model call is real and costs money; the eval run's total is shown at the end.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { describeError } from "@/lib/errors";
import { MODEL_PRICES, MODEL_PROVIDERS, REASONING_EFFORTS, type ReasoningEffort } from "@/lib/model-catalog";
import type { ModelSettings } from "@/server/models/chat-models";
import { getAdminClient } from "@/server/supabase/admin";
import { loadCases } from "../evals/cases";
import { EVAL_CHECKS } from "../evals/checks";
import { runEval } from "../evals/harness";
import { toMarkdown } from "../evals/report";

/** "gpt-6-luna@low" -> the priced model and its effort level. */
function parseModel(text: string): ModelSettings {
  const [model, effort] = text.split("@");
  const provider = MODEL_PROVIDERS.find((candidate) => model in MODEL_PRICES[candidate]);
  if (!provider) throw new Error(`"${model}" is not in src/lib/model-catalog.ts`);
  if (!REASONING_EFFORTS.includes(effort as ReasoningEffort)) {
    throw new Error(`Give an effort level for ${model}: ${REASONING_EFFORTS.map((level) => `${model}@${level}`).join(", ")}`);
  }
  return { provider, model, effort: effort as ReasoningEffort };
}

function modelKey(model: { provider: string; model: string; effort: string | null }): string {
  return `${model.provider}/${model.model}/${model.effort}`;
}

async function startEvalRun(): Promise<string> {
  const { data, error } = await getAdminClient().from("runs").insert({ kind: "eval" }).select("id").single();
  if (error) throw new Error(`Could not start the eval run: ${error.message}`);
  return data.id;
}

async function finishEvalRun(runId: string, status: "succeeded" | "failed"): Promise<void> {
  await getAdminClient().from("runs").update({ status, finished_at: new Date().toISOString() }).eq("id", runId);
}

/** The cost of the run's model calls, per model and effort level. */
async function costsByModel(runId: string): Promise<Map<string, number>> {
  const { data, error } = await getAdminClient()
    .from("model_calls")
    .select("provider, model, effort, cost_usd")
    .eq("run_id", runId);
  if (error) throw new Error(`Could not read the eval run's costs: ${error.message}`);

  const costs = new Map<string, number>();
  for (const call of data) {
    const key = modelKey(call);
    costs.set(key, (costs.get(key) ?? 0) + call.cost_usd);
  }
  return costs;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { models: { type: "string" } } });
  const [checkId] = positionals;
  const check = EVAL_CHECKS[checkId];
  if (!check) {
    const available = Object.keys(EVAL_CHECKS).join(", ") || "none yet";
    throw new Error(`Unknown check "${checkId}". Available checks: ${available}`);
  }
  if (!values.models) throw new Error("Choose models to compare, e.g. --models gpt-6.1-sol@low,gpt-6-luna@low");

  const models = values.models.split(",").map(parseModel);
  const cases = loadCases(check);
  const runId = await startEvalRun();

  try {
    const counts = await runEval(check, cases, models, { runId });
    const costs = await costsByModel(runId);
    const markdown = toMarkdown({
      checkId: check.id,
      checkName: check.name,
      passBar: check.passBar,
      date: new Date().toISOString().slice(0, 10),
      results: counts.map((count) => ({ ...count, costUsd: costs.get(modelKey(count.model)) ?? 0 })),
    });

    const resultsDirectory = fileURLToPath(new URL("../evals/results/", import.meta.url));
    mkdirSync(resultsDirectory, { recursive: true });
    writeFileSync(`${resultsDirectory}${check.id}.md`, markdown);
    console.log(markdown);
    for (const { model, failures } of counts) {
      for (const failure of failures) console.log(`FAILED ${model.model}@${model.effort} ${failure.caseId}: ${failure.reason}`);
    }
    await finishEvalRun(runId, "succeeded");
  } catch (error) {
    await finishEvalRun(runId, "failed");
    throw new Error(`Eval run failed: ${describeError(error)}`);
  }
}

await main();
