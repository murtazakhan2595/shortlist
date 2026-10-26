import "server-only";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { BaseMessage } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import type { z } from "zod";
import type { ModelProvider, ReasoningEffort } from "@/lib/model-catalog";
import { getServerEnv } from "@/server/env";

// OpenAI-compatible APIs (DeepSeek, Groq) can reuse ChatOpenAI with their own base URL and key.

export type ModelSettings = { provider: ModelProvider; model: string; effort: ReasoningEffort };

export type StructuredModel<Output> = Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: Output }>;

// The queue retries failed steps, so the providers' own retries are turned off.
const NO_PROVIDER_RETRIES = 0;

// Only the parts a step marks are cached (ModelContentPart cache: true). In OpenAI's automatic mode the
// whole prompt, ending with the post, is written to the cache at 1.25 times the price and never read again.
const PROMPT_CACHE = { mode: "explicit", ttl: "30m" } as const;

function requireKey(name: "OPENAI_API_KEY"): string {
  const key = getServerEnv()[name];
  if (!key) throw new Error(`${name} is not set, but a step is configured to use this provider`);
  return key;
}

export function createStructuredModel<Schema extends z.ZodObject>(
  settings: ModelSettings,
  schema: Schema,
): StructuredModel<z.infer<Schema>> {
  const options = { includeRaw: true as const, method: "jsonSchema" as const };

  switch (settings.provider) {
    case "openai":
      return new ChatOpenAI({
        model: settings.model,
        apiKey: requireKey("OPENAI_API_KEY"),
        reasoning: { effort: settings.effort },
        useResponsesApi: true,
        maxRetries: NO_PROVIDER_RETRIES,
        promptCacheOptions: PROMPT_CACHE,
      }).withStructuredOutput<z.infer<Schema>>(schema, options);
  }
}
