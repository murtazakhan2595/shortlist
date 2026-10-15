import { expect, test } from "vitest";
import { z } from "zod";
import type { EvalCheck } from "./check";
import { runEval } from "./harness";

// The runner with a fake step: no model is called and nothing is written to the database.
const doubling: EvalCheck<{ value: number; expected: number }, number> = {
  id: "TEST",
  name: "Doubling",
  passBar: 1,
  caseSchema: z.object({ value: z.number(), expected: z.number() }),
  async run(testCase, model) {
    if (testCase.value < 0) throw new Error("negative input");
    // The fake "cheap" model gets large numbers wrong.
    return model.model === "cheap" && testCase.value > 10 ? 0 : testCase.value * 2;
  },
  grade(output, testCase) {
    return { pass: output === testCase.expected, reason: `expected ${testCase.expected}, got ${output}` };
  },
};

const cases = [
  { id: "small", testCase: { value: 2, expected: 4 } },
  { id: "large", testCase: { value: 20, expected: 40 } },
  { id: "broken", testCase: { value: -1, expected: -2 } },
];

const strong = { provider: "openai" as const, model: "strong", effort: "low" as const };
const cheap = { provider: "openai" as const, model: "cheap", effort: "low" as const };

test("counts each model's passes and keeps the reason for every failure", async () => {
  const [strongResult, cheapResult] = await runEval(doubling, cases, [strong, cheap], { runId: "run-1" });

  expect(strongResult).toMatchObject({
    model: strong,
    passed: 2,
    total: 3,
    failures: [{ caseId: "broken", reason: "Error: negative input" }],
  });
  expect(cheapResult).toMatchObject({
    model: cheap,
    passed: 1,
    total: 3,
    failures: [
      { caseId: "large", reason: "expected 40, got 0" },
      { caseId: "broken", reason: "Error: negative input" },
    ],
  });
  expect(strongResult.averageSeconds).toBeGreaterThanOrEqual(0);
});
