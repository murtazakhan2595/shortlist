import "server-only";
import type { ModelPrice } from "@/lib/model-catalog";

export type TokenUsage = { inputTokens: number; outputTokens: number };

export const NO_TOKENS: TokenUsage = { inputTokens: 0, outputTokens: 0 };

const TOKENS_PER_PRICE_UNIT = 1_000_000;

/** Cost in US dollars, rounded to the 6 decimal places model_calls stores. Output tokens include reasoning. */
export function calculateCostUsd(usage: TokenUsage, price: ModelPrice): number {
  const cost =
    (usage.inputTokens * price.inputUsdPerMillionTokens + usage.outputTokens * price.outputUsdPerMillionTokens) /
    TOKENS_PER_PRICE_UNIT;
  return Math.round(cost * 1e6) / 1e6;
}
