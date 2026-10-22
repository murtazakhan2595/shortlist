import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { ApplicationSummary } from "../data";
import { DailyList, dayName, prepared } from "./daily-list";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateApplicationStatus = vi.fn();
vi.mock("../actions", () => ({ updateApplicationStatus: (input: unknown) => updateApplicationStatus(input) }));

// 10:00 on 22 October in Pakistan.
const now = new Date("2026-10-22T05:00:00Z");

const email: ApplicationSummary = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  route: "email",
  status: "ready",
  createdAt: "2026-10-22T04:00:00Z",
  role: "Full-Stack Engineer",
  company: "Acme",
  source: "LinkedIn",
  score: null,
  tags: [],
  inGmail: true,
  href: "/captures/abc",
};

const note: ApplicationSummary = {
  ...email,
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  route: "note",
  createdAt: "2026-10-21T21:30:00Z",
  role: "AI Engineer",
  source: "Himalayas",
  score: 82,
  tags: ["remote"],
  inGmail: false,
  href: "/jobs",
};

test("names days in Pakistan time", () => {
  expect(dayName(new Date("2026-10-21T20:00:00Z"), now)).toBe("Today");
  expect(dayName(new Date("2026-10-21T18:00:00Z"), now)).toBe("Yesterday");
  expect(dayName(new Date("2026-10-19T12:00:00Z"), now)).toBe("Monday 19 October");
});

test("says what was prepared for each kind of application", () => {
  expect(prepared({ route: "email", status: "ready", inGmail: true })).toBe("email draft in Gmail");
  expect(prepared({ route: "email", status: "blocked", inGmail: false })).toBe("email stopped by the checks");
  expect(prepared({ route: "note", status: "preparing", inGmail: false })).toBe("note being written");
  expect(prepared({ route: "note", status: "sent", inGmail: false })).toBe("note to paste");
  expect(prepared({ route: "form", status: "ready", inGmail: false })).toBe("form answers to copy");
});

test("shows each day's applications with source, what was prepared, score and tags (U1)", () => {
  render(<DailyList applications={[email, note]} now={now} />);

  const today = screen.getByRole("region", { name: "Today" });
  expect(within(today).getByRole("link", { name: "Full-Stack Engineer at Acme" })).toHaveAttribute("href", "/captures/abc");
  expect(within(today).getByText("LinkedIn, email draft in Gmail")).toBeInTheDocument();
  expect(within(today).getByText("Himalayas, note to paste, remote")).toBeInTheDocument();
  expect(within(today).getByText("82")).toBeInTheDocument();
});

test("one tap marks an application, and the mark shows at once (U2)", async () => {
  updateApplicationStatus.mockResolvedValue({ ok: true, data: { applicationId: email.id, status: "sent" } });
  render(<DailyList applications={[email]} now={now} />);

  const sent = screen.getByRole("button", { name: "Sent" });
  await userEvent.click(sent);

  expect(updateApplicationStatus).toHaveBeenCalledWith({ applicationId: email.id, status: "sent" });
  expect(sent).toHaveAttribute("aria-pressed", "true");
  expect(refresh).toHaveBeenCalled();
});

test("a refused mark is undone and explained; one being prepared cannot be marked yet", async () => {
  updateApplicationStatus.mockResolvedValue({ ok: false, error: { code: "conflict", message: "Still being prepared" } });
  render(<DailyList applications={[{ ...email, status: "replied" }, { ...note, status: "preparing" }]} now={now} />);

  await userEvent.click(screen.getByRole("button", { name: "Skipped" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Still being prepared");
  expect(screen.getByRole("button", { name: "Replied" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Being prepared\. Mark it once it is ready/)).toBeInTheDocument();
  expect(screen.getAllByRole("group")).toHaveLength(1);
});

test("an empty week invites the owner to start", () => {
  render(<DailyList applications={[]} now={now} />);

  expect(screen.getByText(/Nothing prepared in the last 7 days/)).toBeInTheDocument();
});
