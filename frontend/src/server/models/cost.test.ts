import { expect, test } from "vitest";
import { calculateCostUsd } from "./cost";

const price = { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 };

test("charges input and output tokens at their own prices", () => {
  expect(calculateCostUsd({ inputTokens: 1_000_000, outputTokens: 100_000 }, price)).toBe(3);
});

test("rounds to the 6 decimal places that model_calls stores", () => {
  expect(calculateCostUsd({ inputTokens: 12, outputTokens: 5 }, price)).toBe(0.000074);
});

test("a call that used no tokens costs nothing", () => {
  expect(calculateCostUsd({ inputTokens: 0, outputTokens: 0 }, price)).toBe(0);
});
