import "server-only";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { z } from "zod";
import { describeError } from "@/lib/errors";
import { findModelPrice, MODEL_PROVIDERS, type ModelStep, REASONING_EFFORTS } from "@/lib/model-catalog";
import { getAdminClient } from "@/server/supabase/admin";
import { type ModelSettings, createStructuredModel } from "./chat-models";
import { calculateCostUsd, NO_TOKENS, type TokenUsage } from "./cost";
import { type ModelMessage, toLangChainMessages } from "./messages";

// Every model call in the app goes through callModel (PLAN.md item 1.4; B1, B3).
// It reads the step's model from step_models, asks for an answer in the schema's shape,
// records the call and its cost in model_calls (also when it fails), and returns the checked answer.

// Leaves room inside the 25-second step budget (AGENTS.md, Portability).
export const MODEL_CALL_TIMEOUT_MS = 20_000;

export type ModelCallRequest<Schema extends z.ZodObject> = {
  step: ModelStep;
  schema: Schema;
  messages: ModelMessage[];
  /** What the cost belongs to, so every draft can be explained afterwards. */
  link?: { runId?: string; applicationId?: string };
  /** Used by evaluations to try another model on the same step; the app always uses step_models. */
  model?: ModelSettings;
};

export type ModelCallResult<Output> = { output: Output; modelCallId: string };

type Attempt<Output> = { ok: true; output: Output; usage: TokenUsage } | { ok: false; error: unknown; usage: TokenUsage };

export async function callModel<Schema extends z.ZodObject>(
  request: ModelCallRequest<Schema>,
): Promise<ModelCallResult<z.infer<Schema>>> {
  const settings = request.model ?? (await loadStepSettings(request.step));
  const price = findModelPrice(settings.provider, settings.model);
  if (!price) throw new Error(`No price is known for ${settings.provider}/${settings.model}`);

  const startedAt = performance.now();
  const attempt = await attemptCall(settings, request);
  const durationMs = Math.round(performance.now() - startedAt);

  const modelCallId = await recordModelCall({
    request,
    settings,
    usage: attempt.usage,
    costUsd: calculateCostUsd(attempt.usage, price),
    durationMs,
    error: attempt.ok ? null : describeError(attempt.error),
  });

  if (!attempt.ok) throw attempt.error;
  return { output: attempt.output, modelCallId };
}

async function attemptCall<Schema extends z.ZodObject>(
  settings: ModelSettings,
  request: ModelCallRequest<Schema>,
): Promise<Attempt<z.infer<Schema>>> {
  let usage = NO_TOKENS;
  try {
    const model = createStructuredModel(settings, request.schema);
    const { raw, parsed } = await model.invoke(toLangChainMessages(request.messages), {
      signal: AbortSignal.timeout(MODEL_CALL_TIMEOUT_MS),
    });
    usage = tokenUsage(raw);
    // Checked again here: an answer in the wrong shape fails loudly and the step is retried.
    return { ok: true, output: request.schema.parse(parsed), usage };
  } catch (error) {
    return { ok: false, error, usage };
  }
}

async function loadStepSettings(step: ModelStep): Promise<ModelSettings> {
  const { data, error } = await getAdminClient()
    .from("step_models")
    .select("provider, model, effort")
    .eq("step", step)
    .single();
  if (error) throw new Error(`Could not load the model for step ${step}: ${error.message}`);

  return {
    provider: oneOf(MODEL_PROVIDERS, data.provider, "provider"),
    model: data.model,
    effort: oneOf(REASONING_EFFORTS, data.effort, "effort"),
  };
}

type ModelCallRecord<Schema extends z.ZodObject> = {
  request: ModelCallRequest<Schema>;
  settings: ModelSettings;
  usage: TokenUsage;
  costUsd: number;
  durationMs: number;
  error: string | null;
};

async function recordModelCall<Schema extends z.ZodObject>(record: ModelCallRecord<Schema>): Promise<string> {
  const { data, error } = await getAdminClient()
    .from("model_calls")
    .insert({
      step: record.request.step,
      run_id: record.request.link?.runId ?? null,
      application_id: record.request.link?.applicationId ?? null,
      provider: record.settings.provider,
      model: record.settings.model,
      effort: record.settings.effort,
      input_tokens: record.usage.inputTokens,
      cached_input_tokens: record.usage.cachedInputTokens,
      cache_write_tokens: record.usage.cacheWriteTokens,
      output_tokens: record.usage.outputTokens,
      cost_usd: record.costUsd,
      duration_ms: record.durationMs,
      error: record.error,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not record the model call: ${error.message}`);
  return data.id;
}

function tokenUsage(raw: BaseMessage): TokenUsage {
  const usage = AIMessage.isInstance(raw) ? raw.usage_metadata : undefined;
  return {
    inputTokens: usage?.input_tokens ?? 0,
    cachedInputTokens: usage?.input_token_details?.cache_read ?? 0,
    cacheWriteTokens: usage?.input_token_details?.cache_creation ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

function oneOf<const Options extends readonly string[]>(options: Options, value: string, field: string): Options[number] {
  if (!options.includes(value)) throw new Error(`Unknown ${field} "${value}" in step_models`);
  return value as Options[number];
}
