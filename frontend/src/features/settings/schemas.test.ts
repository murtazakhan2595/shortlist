import { expect, test } from "vitest";
import { UpdateStepModelInputSchema } from "./schemas";

test("a step can switch to a priced model", () => {
  const input = { step: "score_listing", provider: "anthropic", model: "claude-haiku-5-5", effort: "low" };

  expect(UpdateStepModelInputSchema.safeParse(input).success).toBe(true);
});

test("a step cannot use a model without a known price", () => {
  const input = { step: "score_listing", provider: "openai", model: "unpriced-model", effort: "low" };

  expect(UpdateStepModelInputSchema.safeParse(input).success).toBe(false);
});
