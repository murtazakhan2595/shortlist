import "server-only";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { z } from "zod";
import { describeError } from "@/lib/errors";
import { findModelPrice, MODEL_PROVIDERS, type ModelStep, REASONING_EFFORTS } from "@/lib/model-catalog";
import { getAdminClient } from "@/server/supabase/admin";
import { type ModelSettings, createStructuredModel } from "./chat-models";
import { calculateCostUsd, NO_TOKENS, type TokenUsage } from "./cost";
import { type ModelMessage, toLangChainMessages } from "./messages";

// Leaves room inside the 60-second step budget. Reading a full-page screenshot took 22 seconds.
export const MODEL_CALL_TIMEOUT_MS = 50_000;

export type ModelCallRequest<Schema extends z.ZodObject> = {
  step: ModelStep;
  schema: Schema;
  messages: ModelMessage[];
  link?: { runId?: string; applicationId?: string };
  /** For evaluations only; the app always uses step_models. */
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
  }).catch((recordError: unknown) => {
    // A successful call is not used unrecorded: its cost must count toward the monthly cap.
    if (attempt.ok) throw recordError;
    // A failed call's own error says more, so that one is passed on; the lost cost row is logged.
    console.error("A failed model call could not be recorded:", describeError(recordError));
    throw attempt.error;
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
