import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import type { ApplicationView } from "../data";
import { ApplicationDraft } from "./application-draft";

const ready: ApplicationView = {
  status: "ready",
  recipientEmail: "hr@acme.example",
  subject: "Application for React Developer",
  body: "Hi team,\n\nI am applying.\n\nRegards,\nThe Owner",
  presentedTitle: "Full-Stack Developer",
  cvFileName: "CV-Full-Stack.pdf",
  emailPattern: "post-reply",
  blockedReason: null,
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
