import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ReplyRates } from "./reply-rates";
import { RunCosts } from "./run-costs";

test("shows each source's replies and interviews with their share of those sent (U5)", () => {
  render(
    <ReplyRates
      rates={{
        bySource: [{ name: "LinkedIn", sent: 8, replied: 2, interviews: 1 }],
        byPattern: [{ name: "post-reply", sent: 4, replied: 1, interviews: 0 }],
      }}
    />,
  );

  const linkedIn = screen.getByRole("row", { name: /LinkedIn/ });
  expect(within(linkedIn).getByText("2 (25%)")).toBeInTheDocument();
  expect(within(linkedIn).getByText("1 (13%)")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "By email pattern" })).toBeInTheDocument();
});

test("before anything is marked sent, says how the rates fill in", () => {
  render(<ReplyRates rates={{ bySource: [], byPattern: [] }} />);

  expect(screen.getByText(/Nothing marked sent yet/)).toBeInTheDocument();
});

test("shows each night's counts and cost, and says when a run did not finish", () => {
  render(
    <RunCosts
      runs={[
        { id: "a", startedAt: "2026-10-21T21:00:00Z", status: "running", fetched: 40, kept: 12, scored: 11, onList: 5, costUsd: 0.31 },
      ]}
    />,
  );

  const row = screen.getAllByRole("row")[1];
  expect(row).toHaveTextContent("Thu 22 Oct, not finished");
  expect(within(row).getByText("$0.3100")).toBeInTheDocument();
  expect(within(row).getByText("5")).toBeInTheDocument();
});
