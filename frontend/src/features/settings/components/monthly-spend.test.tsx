import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MonthlySpend } from "./monthly-spend";

test("shows the chosen month's total and steps, with a link to every month (B1)", () => {
  render(
    <MonthlySpend
      spend={{
        months: ["2026-11", "2026-10"],
        month: "2026-10",
        totalUsd: 1.4495,
        calls: 102,
        steps: [
          { step: "write_email", calls: 35, costUsd: 0.8955 },
          { step: "check_email", calls: 67, costUsd: 0.554 },
        ],
      }}
    />,
  );

  expect(screen.getByText("$1.45")).toBeInTheDocument();
  expect(screen.getByText(/in October 2026, 102 model calls/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "October 2026" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "November 2026" })).toHaveAttribute("href", "/settings?month=2026-11");
  expect(screen.getAllByRole("row")).toHaveLength(3);
});
