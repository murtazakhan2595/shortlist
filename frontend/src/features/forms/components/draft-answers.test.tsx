import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { fail, ok } from "@/lib/result";
import { draftListingAnswers } from "../actions";
import { DraftAnswers } from "./draft-answers";

vi.mock("../actions", () => ({ draftListingAnswers: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const listingId = "0f8fad5b-d9cb-469f-a165-70867728950e";

beforeEach(() => vi.clearAllMocks());

test("nothing is drafted until asked; asking starts the answers and shows them", async () => {
  vi.mocked(draftListingAnswers).mockResolvedValue(ok({ applicationId: "form-1" }));
  render(<DraftAnswers listingId={listingId} form={null} />);
  expect(screen.getByText(/for about 6 cents/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Draft answers" }));

  expect(draftListingAnswers).toHaveBeenCalledWith({ listingId });
  expect(refresh).toHaveBeenCalled();
});

test("a refused request says why", async () => {
  vi.mocked(draftListingAnswers).mockResolvedValue(fail("not_found", "This job is no longer on the list."));
  render(<DraftAnswers listingId={listingId} form={null} />);

  await userEvent.click(screen.getByRole("button", { name: "Draft answers" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("This job is no longer on the list.");
});

test("while drafting, and once drafted, it links to the answers instead of asking again", () => {
  const { rerender } = render(<DraftAnswers listingId={listingId} form={{ id: "form-1", status: "preparing" }} />);
  expect(screen.getByText(/Drafting answers to its questions/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();

  rerender(<DraftAnswers listingId={listingId} form={{ id: "form-1", status: "ready" }} />);
  expect(screen.getByText(/Answers drafted/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open the answers" })).toHaveAttribute("href", "/forms/form-1");
});

test("a job that closed before its questions were read says so", () => {
  render(<DraftAnswers listingId={listingId} form={{ id: "form-1", status: "blocked" }} />);

  expect(screen.getByText("No answers: the job has closed on Greenhouse.")).toBeInTheDocument();
});
