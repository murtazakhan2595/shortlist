import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { FailureNotice } from "./failure-notice";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const retryFailedStep = vi.fn();
vi.mock("../actions", () => ({ retryFailedStep: (input: unknown) => retryFailedStep(input) }));

const failure = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  step: "create_gmail_draft",
  error: "Error: Gmail refused the request",
  failedAt: "2026-10-22T09:30:00Z",
  targetIds: [],
};

beforeEach(() => {
  refresh.mockClear();
  retryFailedStep.mockReset();
});

test("says what failed, in plain words, and why", () => {
  render(<FailureNotice failure={failure} />);

  expect(screen.getByRole("alert")).toHaveTextContent("Saving the draft to Gmail failed");
  expect(screen.getByText(/Gmail refused the request/)).toBeInTheDocument();
  expect(screen.getByText(/22 Oct, 14:30/)).toBeInTheDocument();
});

test("Try again queues the step once more and refreshes the page", async () => {
  retryFailedStep.mockResolvedValue({ ok: true, data: { failedStepId: failure.id } });
  render(<FailureNotice failure={failure} />);

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(retryFailedStep).toHaveBeenCalledWith({ failedStepId: failure.id });
  expect(refresh).toHaveBeenCalled();
});

test("a failure already tried again in another tab just refreshes; any other error is shown", async () => {
  retryFailedStep.mockResolvedValueOnce({ ok: false, error: { code: "conflict", message: "This was already tried again." } });
  retryFailedStep.mockResolvedValueOnce({ ok: false, error: { code: "internal", message: "Could not queue step" } });
  render(<FailureNotice failure={failure} />);

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(refresh).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Could not queue step")).toBeInTheDocument();
  expect(refresh).toHaveBeenCalledTimes(1);
});
