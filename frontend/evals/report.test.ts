import { expect, test } from "vitest";
import { toMarkdown } from "./report";

test("shows each model's pass rate against the bar, with cost and time", () => {
  const markdown = toMarkdown({
    checkId: "E1",
    checkName: "Extraction from captured posts",
    passBar: 0.95,
    date: "2026-10-15",
    results: [
      { model: { provider: "openai", model: "gpt-6.1-sol", effort: "low" }, passed: 20, total: 20, averageSeconds: 11.6, costUsd: 0.1, failures: [] },
      { model: { provider: "openai", model: "gpt-6-luna", effort: "low" }, passed: 17, total: 20, averageSeconds: 5.94, costUsd: 0.012, failures: [] },
    ],
  });

  expect(markdown).toContain("# E1: Extraction from captured posts");
  expect(markdown).toContain("Pass bar: 95% of cases.");
  expect(markdown).toContain("| gpt-6.1-sol | low | 20/20 | 100% | yes | $0.1000 | 11.6 s |");
  expect(markdown).toContain("| gpt-6-luna | low | 17/20 | 85% | no | $0.0120 | 5.9 s |");
});
