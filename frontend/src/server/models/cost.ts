import "server-only";
import type { ModelPrice } from "@/lib/model-catalog";

/** cachedInputTokens is the part of inputTokens read from the provider's prompt cache. */
export type TokenUsage = { inputTokens: number; cachedInputTokens: number; outputTokens: number };

export const NO_TOKENS: TokenUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };

const TOKENS_PER_PRICE_UNIT = 1_000_000;

/** Cost in US dollars, rounded to the 6 decimal places model_calls stores. Output tokens include reasoning. */
export function calculateCostUsd(usage: TokenUsage, price: ModelPrice): number {
  const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens;
  const cost =
    (uncachedInputTokens * price.inputUsdPerMillionTokens +
      usage.cachedInputTokens * price.cachedInputUsdPerMillionTokens +
      usage.outputTokens * price.outputUsdPerMillionTokens) /
    TOKENS_PER_PRICE_UNIT;
  return Math.round(cost * 1e6) / 1e6;
}
