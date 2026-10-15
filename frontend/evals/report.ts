import type { EvalReport, ModelResult } from "./check";

// The results table committed to evals/results/. Numbers only, never case content.

function passRate(result: ModelResult): number {
  return result.total === 0 ? 0 : result.passed / result.total;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function toMarkdown(report: EvalReport): string {
  const rows = report.results.map((result) => {
    const meetsBar = passRate(result) >= report.passBar ? "yes" : "no";
    return [
      result.model.model,
      result.model.effort,
      `${result.passed}/${result.total}`,
      percent(passRate(result)),
      meetsBar,
      `$${result.costUsd.toFixed(4)}`,
      `${result.averageSeconds.toFixed(1)} s`,
    ].join(" | ");
  });

  return [
    `# ${report.checkId}: ${report.checkName}`,
    "",
    `Run on ${report.date}. Pass bar: ${percent(report.passBar)} of cases.`,
    "",
    "| Model | Effort | Passed | Pass rate | Meets bar | Cost | Average time |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
}
