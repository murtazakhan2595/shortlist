import { expect, test } from "vitest";
import { calculateCostUsd } from "./cost";

const price = { inputUsdPerMillionTokens: 2, cachedInputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 10 };

test("charges input and output tokens at their own prices", () => {
  expect(calculateCostUsd({ inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 100_000 }, price)).toBe(3);
});

test("charges the cached part of the input at the cached price", () => {
  const usage = { inputTokens: 1_000_000, cachedInputTokens: 800_000, outputTokens: 0 };

  // 200,000 uncached at $2 per million, plus 800,000 cached at $0.10 per million.
  expect(calculateCostUsd(usage, price)).toBe(0.48);
});

test("rounds to the 6 decimal places that model_calls stores", () => {
  expect(calculateCostUsd({ inputTokens: 12, cachedInputTokens: 0, outputTokens: 5 }, price)).toBe(0.000074);
});

test("a call that used no tokens costs nothing", () => {
  expect(calculateCostUsd({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }, price)).toBe(0);
});
