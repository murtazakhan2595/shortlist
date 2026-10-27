import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  email: { status: "preparing", to: "jobs@acme.com", body: null, inGmail: false, blockedReason: null },
  cv: null,
  canDraftAnswers: false,
  form: null,
  failure: null,
};

const hackerNewsJob: JobView = { ...job, id: "job-2", title: "Backend Developer", source: "hackernews", topRank: null, score: 60, email: null };

type Jobs = { top: JobView[]; more: JobView[]; earlierRun?: string };

function listWith(himalayas: Jobs, hackerNews: Jobs = { top: [], more: [hackerNewsJob] }): JobsListView {
  return {
    run: { startedAt: "2026-10-21T21:00:00Z", status: "succeeded", fetched: 40, kept: 12, costUsd: 0.2, warning: null },
    failures: [],
    sources: [
      { source: "himalayas", name: "Himalayas", earlierRun: null, ...himalayas },
      { source: "hackernews", name: "Hacker News", earlierRun: null, ...hackerNews },
    ],
  };
}
const list = listWith({ top: [job], more: [] });

const renderFailure = (shown: OpenFailure) => <p key={shown.id}>Failed: {shown.step}</p>;

test("a job whose email failed shows the failure in place of the email", () => {
  render(<JobsList list={listWith({ top: [{ ...job, failure: failure("f1", "advance_writer") }], more: [] })} renderFailure={renderFailure} renderAnswers={() => null} />);

  const row = screen.getByRole("listitem");
  expect(within(row).getByText("Failed: advance_writer")).toBeInTheDocument();
  expect(within(row).queryByText(/Writing the email/)).not.toBeInTheDocument();
});

test("one tab per source, each with its own top jobs and the rest below by score", async () => {
  const user = userEvent.setup();
  render(<JobsList list={list} renderFailure={renderFailure} renderAnswers={() => null} />);

  // Himalayas is shown first.
  expect(screen.getByRole("radio", { name: "Himalayas (1)" })).toBeChecked();
  expect(screen.getByRole("heading", { name: "Full Stack Engineer" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Backend Developer" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: "Hacker News (1)" }));

  expect(screen.getByRole("heading", { name: "Backend Developer" })).toBeInTheDocument();
  expect(screen.getByText("No job from Hacker News fitted well enough to make the top this time.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "More from Hacker News (1)" })).toBeInTheDocument();
});

test("a source with no new jobs says so", async () => {
  const user = userEvent.setup();
  render(<JobsList list={listWith({ top: [job], more: [] }, { top: [], more: [] })} renderFailure={renderFailure} renderAnswers={() => null} />);

  await user.click(screen.getByRole("radio", { name: "Hacker News (0)" }));

  expect(screen.getByText("No new jobs from Hacker News this time.")).toBeInTheDocument();
});

test("on a phone, one picker chooses the source instead of a tab per source", async () => {
  const user = userEvent.setup();
  render(<JobsList list={listWith({ top: [job], more: [] }, { top: [], more: [] })} renderFailure={renderFailure} renderAnswers={() => null} />);

  await user.selectOptions(screen.getByRole("combobox", { name: "Jobs from" }), "Hacker News (0)");

  expect(screen.getByText("No new jobs from Hacker News this time.")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Hacker News (0)" })).toBeChecked();
});

test("a source with nothing new keeps its last list and says which night it is from", async () => {
  const user = userEvent.setup();
  render(
    <JobsList list={listWith({ top: [job], more: [] }, { top: [], more: [hackerNewsJob], earlierRun: "2026-10-20T21:00:00Z" })} renderFailure={renderFailure} renderAnswers={() => null} />,
  );

  // The latest run's own source says nothing about an earlier night.
  expect(screen.queryByText(/These are from/)).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: "Hacker News (1)" }));

  expect(screen.getByText("No new jobs from Hacker News this time. These are from Wednesday 21 October.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Backend Developer" })).toBeInTheDocument();
});

test("the run's own failures and its warning are shown at the top", () => {
  const stuck = {
    ...list,
    run: { ...list.run, status: "running", warning: "The nightly run has not finished after 6 hours." },
    failures: [failure("f2", "fetch_listings")],
  };

  render(<JobsList list={stuck} renderFailure={renderFailure} renderAnswers={() => null} />);

  expect(screen.getByRole("alert")).toHaveTextContent("The nightly run has not finished after 6 hours.");
  expect(screen.getByText("Failed: fetch_listings")).toBeInTheDocument();
  expect(screen.getByText(/40 jobs read, 12 new/)).toBeInTheDocument();
});
