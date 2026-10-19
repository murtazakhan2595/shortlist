import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { ApplicationView } from "../data";
import { ApplicationDraft } from "./application-draft";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const ready: ApplicationView = {
  status: "ready",
  recipientEmail: "hr@acme.example",
  subject: "Application for React Developer",
  body: "Hi team,\n\nI am applying.\n\nRegards,\nThe Owner",
  presentedTitle: "Full-Stack Developer",
  cvFileName: "CV-Full-Stack.pdf",
  emailPattern: "post-reply",
  blockedReason: null,
  inGmail: true,
};

test("shows the prepared email with its recipient, subject, CV and pattern", () => {
  render(<ApplicationDraft application={ready} />);

  expect(screen.getByRole("heading", { name: "The prepared email" })).toBeInTheDocument();
  expect(screen.getByText("hr@acme.example")).toBeInTheDocument();
  expect(screen.getByText("CV-Full-Stack.pdf")).toBeInTheDocument();
  expect(screen.getByText(/I am applying\./)).toBeInTheDocument();
});

test("shows why a draft was stopped, one problem per line (X4)", () => {
  render(
    <ApplicationDraft
      application={{ ...ready, status: "blocked", blockedReason: '"5 years": the profile says 3\n"Kubernetes": not in the profile' }}
    />,
  );

  expect(screen.getByRole("heading", { name: "The draft was stopped" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("shows nothing while the application is still being written", () => {
  const { container } = render(<ApplicationDraft application={{ ...ready, status: "preparing" }} />);

  expect(container).toBeEmptyDOMElement();
});

test("says when the email is in Gmail, and while it is still being saved there (X1)", () => {
  const { rerender } = render(<ApplicationDraft application={ready} />);
  expect(screen.getByRole("status")).toHaveTextContent("Saved as a draft in Gmail");
  expect(screen.getByRole("link", { name: "Open Gmail drafts" })).toHaveAttribute("href", "https://mail.google.com/mail/#drafts");

  rerender(<ApplicationDraft application={{ ...ready, inGmail: false }} />);
  expect(screen.getByText(/Saving to Gmail/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
});
