import { expect, test } from "vitest";
import { filterJobs, type JobView, runWarning } from "./data";

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

const job = (id: string, score: number | null, label: JobView["label"]) => ({ id, score, label }) as JobView;
const ids = (jobs: JobView[]) => jobs.map((shown) => shown.id);

test("hides unmarked jobs scored under the lowest score, and counts them", () => {
  const jobs = [job("high", 80, null), job("low", 40, null), job("marked-low", 40, "apply"), job("unscored", null, null)];

  const { shown, hidden } = filterJobs(jobs, "all", 60);

  expect(ids(shown)).toEqual(["high", "marked-low", "unscored"]);
  expect(hidden).toBe(1);
});

test("shows only the jobs marked as asked, or the ones not marked yet", () => {
  const jobs = [job("apply", 80, "apply"), job("skip", 80, "skip"), job("new", 80, null)];

  expect(ids(filterJobs(jobs, "apply", 0).shown)).toEqual(["apply"]);
  expect(ids(filterJobs(jobs, "skip", 0).shown)).toEqual(["skip"]);
  expect(ids(filterJobs(jobs, "undecided", 0).shown)).toEqual(["new"]);
  expect(ids(filterJobs(jobs, "all", 0).shown)).toEqual(["apply", "skip", "new"]);
});
