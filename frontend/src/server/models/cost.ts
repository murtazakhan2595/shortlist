import "server-only";
import type { ModelPrice } from "@/lib/model-catalog";

/** cachedInputTokens and cacheWriteTokens are parts of inputTokens. */
export type TokenUsage = { inputTokens: number; cachedInputTokens: number; cacheWriteTokens: number; outputTokens: number };

export const NO_TOKENS: TokenUsage = { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };

const TOKENS_PER_PRICE_UNIT = 1_000_000;

/** Rounded to the 6 decimal places model_calls stores. Output tokens include reasoning. */
export function calculateCostUsd(usage: TokenUsage, price: ModelPrice): number {
  const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens;
  const cost =
    (uncachedInputTokens * price.inputUsdPerMillionTokens +
      usage.cachedInputTokens * price.cachedInputUsdPerMillionTokens +
      usage.cacheWriteTokens * price.cacheWriteInputUsdPerMillionTokens +
      usage.outputTokens * price.outputUsdPerMillionTokens) /
    TOKENS_PER_PRICE_UNIT;
  return Math.round(cost * 1e6) / 1e6;
}
