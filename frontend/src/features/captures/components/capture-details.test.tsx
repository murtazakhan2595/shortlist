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
  createdAt: "2026-10-19T00:00:00Z",
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
