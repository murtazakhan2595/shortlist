import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { OpenFailure } from "@/server/queue/failed-steps";
import type { JobsListView, JobView } from "../data";
import { JobsList } from "./jobs-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ labelListing: vi.fn() }));

const failure = (id: string, step: string): OpenFailure => ({ id, step, error: "broke", failedAt: "2026-10-22T00:00:00Z", targetIds: [] });

const job: JobView = {
  id: "job-1",
  title: "Full Stack Engineer",
  company: "Acme",
  source: "himalayas",
  location: null,
  url: "https://himalayas.app/companies/acme/jobs/1",
  tags: [],
  eligibility: "eligible",
  eligibilityReason: null,
  topRank: 1,
  score: 80,
  reasons: null,
  label: null,
  note: { status: "preparing", body: null, cvVariant: null, blockedReason: null },
  failure: null,
};

const list: JobsListView = {
  run: { startedAt: "2026-10-21T21:00:00Z", status: "succeeded", fetched: 40, kept: 12, costUsd: 0.2, warning: null },
  failures: [],
  top: [job],
  alsoScored: [],
  dropped: [],
};

const renderFailure = (shown: OpenFailure) => <p key={shown.id}>Failed: {shown.step}</p>;

test("a job whose note failed shows the failure in place of the note", () => {
  render(<JobsList list={{ ...list, top: [{ ...job, failure: failure("f1", "advance_writer") }] }} renderFailure={renderFailure} />);

  const row = screen.getByRole("listitem");
  expect(within(row).getByText("Failed: advance_writer")).toBeInTheDocument();
  expect(within(row).queryByText("Writing the note…")).not.toBeInTheDocument();
});

test("the run's own failures and its warning are shown at the top", () => {
  const stuck = {
    ...list,
    run: { ...list.run, status: "running", warning: "The nightly run has not finished after 6 hours." },
    failures: [failure("f2", "fetch_listings")],
  };

  render(<JobsList list={stuck} renderFailure={renderFailure} />);

  expect(screen.getByRole("alert")).toHaveTextContent("The nightly run has not finished after 6 hours.");
  expect(screen.getByText("Failed: fetch_listings")).toBeInTheDocument();
  expect(screen.getByText(/40 jobs read, 12 new/)).toBeInTheDocument();
});
