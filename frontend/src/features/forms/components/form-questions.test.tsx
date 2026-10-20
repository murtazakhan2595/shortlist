import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { ok } from "@/lib/result";
import { answerFormQuestion } from "../actions";
import type { FormQuestion } from "../data";
import { FormQuestions } from "./form-questions";

vi.mock("../actions", () => ({ answerFormQuestion: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const base: Omit<FormQuestion, "id" | "position" | "question" | "status"> = { options: [], answer: null, note: null };

const questions: FormQuestion[] = [
  { ...base, id: "q1", position: 1, question: "Name", status: "answered", answer: "Sam Khan" },
  { ...base, id: "q2", position: 2, question: "Docker?", options: ["Yes", "No"], status: "answered", answer: "Yes" },
  { ...base, id: "q3", position: 3, question: "Spoken English out of 10?", status: "needs_input", note: "No number is stored." },
  { ...base, id: "q4", position: 4, question: "Attach your CV", status: "asset_needed", answer: "full_stack CV", note: "Upload the CV." },
  { ...base, id: "q5", position: 5, question: "Notice period?", status: "pending" },
];

beforeEach(() => vi.clearAllMocks());

test("shows each question in order with what to do about it", () => {
  render(<FormQuestions questions={questions} />);
  const items = screen.getAllByRole("listitem");

  expect(within(items[0]).getByText("Sam Khan", { selector: "p" })).toBeInTheDocument();
  expect(within(items[0]).getByRole("button", { name: "Copy" })).toBeInTheDocument();
  // A choice is picked on the form, not pasted.
  expect(within(items[1]).getByText("Choices: Yes, No")).toBeInTheDocument();
  expect(within(items[1]).queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  expect(within(items[2]).getByText("Needs your input.")).toBeInTheDocument();
  expect(within(items[2]).getByText("No number is stored.")).toBeInTheDocument();
  expect(within(items[3]).getByText("Upload this yourself.")).toBeInTheDocument();
  expect(within(items[3]).getByText("full_stack CV", { selector: "p" })).toBeInTheDocument();
  expect(within(items[4]).getByText("Answering…")).toBeInTheDocument();
});

test("the owner's answer is saved, to the answer bank too unless they untick it", async () => {
  vi.mocked(answerFormQuestion).mockResolvedValue(ok({ formAnswerId: "q3", answerBankVersion: null }));
  const user = userEvent.setup();
  render(<FormQuestions questions={[questions[2]]} />);

  await user.type(screen.getByLabelText("Your answer"), "8");
  await user.click(screen.getByLabelText("Save to my answer bank for next time"));
  await user.click(screen.getByRole("button", { name: "Save answer" }));

  expect(answerFormQuestion).toHaveBeenCalledWith({ formAnswerId: "q3", answer: "8", saveToAnswerBank: false });
  expect(refresh).toHaveBeenCalled();
});
