import { expect, test } from "vitest";
import { runWarning } from "./data";

const startedAt = "2026-10-21T21:00:00Z";
const hoursLater = (hours: number) => new Date(new Date(startedAt).getTime() + hours * 3_600_000);

test("a run still going within the night, or finished within the day, needs nothing", () => {
  expect(runWarning({ status: "running", started_at: startedAt }, hoursLater(2))).toBeNull();
  expect(runWarning({ status: "succeeded", started_at: startedAt }, hoursLater(20))).toBeNull();
});

test("warns when the run has not finished, failed, or no newer run started", () => {
  expect(runWarning({ status: "running", started_at: startedAt }, hoursLater(7))).toMatch(/not finished after 6 hours/);
  expect(runWarning({ status: "failed", started_at: startedAt }, hoursLater(1))).toMatch(/stopped before it finished/);
  expect(runWarning({ status: "succeeded", started_at: startedAt }, hoursLater(27))).toMatch(/No nightly run has started for over a day/);
});
