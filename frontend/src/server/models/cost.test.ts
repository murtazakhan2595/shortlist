import { expect, test } from "vitest";
import { calculateCostUsd, NO_TOKENS } from "./cost";

const price = {
  inputUsdPerMillionTokens: 2,
  cachedInputUsdPerMillionTokens: 0.1,
  cacheWriteInputUsdPerMillionTokens: 2.5,
  outputUsdPerMillionTokens: 10,
};

test("charges input and output tokens at their own prices", () => {
  expect(calculateCostUsd({ ...NO_TOKENS, inputTokens: 1_000_000, outputTokens: 100_000 }, price)).toBe(3);
});

test("charges the input read from and written to the prompt cache at their own prices", () => {
  const usage = { ...NO_TOKENS, inputTokens: 1_000_000, cachedInputTokens: 600_000, cacheWriteTokens: 200_000 };

  // 200,000 uncached at $2, 600,000 read at $0.10 and 200,000 written at $2.50, per million.
  expect(calculateCostUsd(usage, price)).toBe(0.96);
});

test("rounds to the 6 decimal places that model_calls stores", () => {
  expect(calculateCostUsd({ ...NO_TOKENS, inputTokens: 12, outputTokens: 5 }, price)).toBe(0.000074);
});

test("a call that used no tokens costs nothing", () => {
  expect(calculateCostUsd(NO_TOKENS, price)).toBe(0);
});
