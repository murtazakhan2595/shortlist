import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { CaptureView } from "../data";
import { CaptureDetails } from "./capture-details";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const capture: CaptureView = {
  id: "abc",
  inputType: "text",
  status: "processing",
  role: "Full-Stack Engineer",
  company: null,
  posterName: "Sara Khan",
  contactEmail: "jobs@acme.example",
  formUrl: null,
  postUrl: null,
  postText: null,
  screenshotUrls: [],
  createdAt: "2026-10-19T00:00:00Z",
  failure: null,
};

test("while the post is being read, says so and shows nothing read yet", () => {
  render(<CaptureDetails capture={{ ...capture, status: "received", role: null }} />);

  expect(screen.getByText("Reading the post…")).toBeInTheDocument();
  expect(screen.queryByText("Role")).not.toBeInTheDocument();
});

test("shows what was read while the application is written", () => {
  render(<CaptureDetails capture={capture} />);

  expect(screen.getByText("Writing the application…")).toBeInTheDocument();
  expect(screen.getByText("jobs@acme.example")).toBeInTheDocument();
  expect(screen.getByText("Full-Stack Engineer")).toBeInTheDocument();
  expect(screen.getByText("Not stated")).toBeInTheDocument();
});

test("shows a form link without opening it", () => {
  const formUrl = "https://forms.gle/abc123";
  render(<CaptureDetails capture={{ ...capture, status: "needs_form", contactEmail: null, formUrl }} />);

  expect(screen.getByRole("link", { name: formUrl })).toHaveAttribute("href", formUrl);
});

test("says when the same job was captured before", () => {
  render(<CaptureDetails capture={{ ...capture, status: "duplicate" }} />);

  expect(screen.getByText("You already have an application for this job")).toBeInTheDocument();
});

test("says when a post gives no way to apply", () => {
  render(<CaptureDetails capture={{ ...capture, status: "no_contact", contactEmail: null }} />);

  expect(screen.getByText("No email or application link found")).toBeInTheDocument();
});

test("a step that failed for good replaces the progress, and stops the page refreshing itself", () => {
  render(<CaptureDetails capture={capture} failureNotice={<p>Writing the draft failed</p>} />);

  expect(screen.getByText("Writing the draft failed")).toBeInTheDocument();
  expect(screen.queryByText("Writing the application…")).not.toBeInTheDocument();
});

test("a failure notice is not shown once the post is done", () => {
  render(<CaptureDetails capture={{ ...capture, status: "done" }} failureNotice={<p>Saving the draft to Gmail failed</p>} />);

  expect(screen.queryByText("Saving the draft to Gmail failed")).not.toBeInTheDocument();
});
