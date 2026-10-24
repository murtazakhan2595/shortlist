import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { fail, ok } from "@/lib/result";
import { blockCompany, labelListing } from "../actions";
import type { JobView } from "../data";
import { JobRow } from "./job-row";

vi.mock("../actions", () => ({ labelListing: vi.fn(), blockCompany: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const JOB: JobView = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Full Stack Engineer",
  company: "Acme",
  source: "himalayas",
  location: "Worldwide",
  url: "https://himalayas.app/companies/acme/jobs/full-stack-engineer",
  tags: ["remote", "visa"],
  eligibility: "eligible",
  eligibilityReason: null,
  topRank: 1,
  score: 84,
  reasons: "Strengths:\n- React",
  label: null,
  note: { status: "ready", body: "I build React apps.", cvVariant: "ai_full_stack", blockedReason: null, email: null },
  failure: null,
};

function renderRow(job: JobView = JOB) {
  render(
    <ol>
      <JobRow job={job} />
    </ol>,
  );
}

beforeEach(() => {
  vi.mocked(labelListing).mockReset();
});

test("shows the job, its score, its note to copy, the CV and the link to Himalayas", () => {
  renderRow();

  expect(screen.getByRole("heading", { name: "Full Stack Engineer" })).toBeInTheDocument();
  expect(screen.getByText("Acme, Worldwide, remote, sponsors visas")).toBeInTheDocument();
  expect(screen.getByText("84")).toBeInTheDocument();
  expect(screen.getByText("I build React apps.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  expect(screen.getByText("Send your ai full stack CV.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open the job on Himalayas" })).toHaveAttribute("href", JOB.url);
});

test("marking a job saves the mark and shows it at once", async () => {
  vi.mocked(labelListing).mockResolvedValue(ok({ listingId: JOB.id, label: "skip" }));
  const user = userEvent.setup();
  renderRow();

  await user.click(screen.getByRole("button", { name: "Skip" }));

  expect(labelListing).toHaveBeenCalledWith({ listingId: JOB.id, label: "skip" });
  expect(screen.getByRole("button", { name: "Skip" })).toHaveAttribute("aria-pressed", "true");
});

test("a skipped job is struck through, and an applied one is ticked", () => {
  renderRow({ ...JOB, id: "skipped", title: "Skipped job", label: "skip" });
  renderRow({ ...JOB, id: "applied", title: "Applied job", label: "apply" });

  expect(screen.getByRole("heading", { name: "Skipped job" })).toHaveClass("line-through");
  expect(screen.getByRole("heading", { name: "Applied job" })).not.toHaveClass("line-through");
  expect(screen.getAllByText("✓")).toHaveLength(1);
  expect(screen.getByRole("group", { name: "Mark Applied job" })).toContainElement(
    screen.getAllByRole("button", { name: "Apply", pressed: true })[0],
  );
});

test("a mark that was not saved goes back, and says why", async () => {
  vi.mocked(labelListing).mockResolvedValue(fail("not_found", "This job is no longer listed"));
  const user = userEvent.setup();
  renderRow();

  await user.click(screen.getByRole("button", { name: "Apply" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("This job is no longer listed");
  expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute("aria-pressed", "false");
});

test("an unclear job says what to check, and a stopped note says why and to write it yourself", () => {
  renderRow({
    ...JOB,
    eligibility: "unclear",
    eligibilityReason: "Mentions work authorisation or where you must live",
    note: {
      status: "blocked",
      body: null,
      cvVariant: null,
      blockedReason: "The body has 140 words; the job-board-note pattern needs 40 to 90.\nRemove the banned phrase \"leverage\".",
      email: null,
    },
  });

  expect(screen.getByText(/Mentions work authorisation/)).toBeInTheDocument();
  expect(screen.getByText(/Write this one yourself/)).toBeInTheDocument();
  expect(screen.getByText(/The body has 140 words/)).toBeInTheDocument();
  expect(screen.getByText(/Remove the banned phrase/)).toBeInTheDocument();
});

test("blocks the company only after a confirming tap, and can be kept instead", async () => {
  vi.mocked(blockCompany).mockResolvedValue(ok({ company: "Acme", listingsDropped: 3 }));
  const user = userEvent.setup();
  renderRow();

  await user.click(screen.getByRole("button", { name: "Block Acme" }));
  expect(blockCompany).not.toHaveBeenCalled();
  expect(screen.getByText(/Hide every job from Acme/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Keep" }));
  expect(screen.queryByText(/Hide every job from Acme/)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Block Acme" }));
  await user.click(screen.getByRole("button", { name: "Block Acme" }));
  expect(blockCompany).toHaveBeenCalledWith({ listingId: JOB.id });
});

test("says why a company could not be blocked", async () => {
  vi.mocked(blockCompany).mockResolvedValue(fail("not_found", "This job is no longer listed"));
  const user = userEvent.setup();
  renderRow();

  await user.click(screen.getByRole("button", { name: "Block Acme" }));
  await user.click(screen.getByRole("button", { name: "Block Acme" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("This job is no longer listed");
});

test("a Hacker News job links to its post there", () => {
  renderRow({ ...JOB, source: "hackernews", url: "https://news.ycombinator.com/item?id=1" });

  expect(screen.getByRole("link", { name: "Open the job on Hacker News" })).toHaveAttribute("href", "https://news.ycombinator.com/item?id=1");
});

test("an email for a post that gave an address says who it goes to and that it is in Gmail, with no CV line", () => {
  renderRow({
    ...JOB,
    note: { status: "ready", body: "Hello, I build React apps.", cvVariant: "full_stack", blockedReason: null, email: { to: "jobs@acme.com", inGmail: true } },
  });

  expect(screen.getByText("Email to jobs@acme.com:")).toBeInTheDocument();
  expect(screen.getByText(/in your Gmail drafts, with your CV attached/)).toBeInTheDocument();
  expect(screen.getByText("Hello, I build React apps.")).toBeInTheDocument();
  expect(screen.queryByText(/Send your/)).not.toBeInTheDocument();
});

test("an email still being written says so", () => {
  renderRow({ ...JOB, note: { status: "preparing", body: null, cvVariant: null, blockedReason: null, email: { to: "jobs@acme.com", inGmail: false } } });

  expect(screen.getByText("Writing the email…")).toBeInTheDocument();
});
