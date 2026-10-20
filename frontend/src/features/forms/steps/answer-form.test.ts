import { expect, test } from "vitest";
import { afterCheck, type ModelAnswer, settleAnswers } from "./answer-form";

const question = (position: number, options: string[] = []) => ({
  id: `q${position}`,
  position,
  question: `Question ${position}`,
  options,
  answer: null,
});

const answered = (position: number, answer: string): ModelAnswer => ({ position, status: "answered", answer, note: null });

test("a supported answer goes on to be checked", () => {
  expect(settleAnswers([question(1)], [answered(1, " Three years ")])).toEqual([
    { id: "q1", status: "checking", answer: "Three years", note: null },
  ]);
});

test("a question the model skipped or left empty goes to the owner", () => {
  const [skipped, empty] = settleAnswers([question(1), question(2)], [answered(2, "  ")]);

  expect(skipped).toMatchObject({ status: "needs_input", answer: null });
  expect(empty).toMatchObject({ status: "needs_input", answer: null });
});

test("a choice the form does not offer goes to the owner; offered choices, ticked together, are kept", () => {
  const questions = [question(1, ["Yes", "No"]), question(2, ["AWS", "Docker", "Kubernetes"])];
  const settled = settleAnswers(questions, [answered(1, "Maybe"), answered(2, "aws; Docker")]);

  expect(settled[0]).toMatchObject({ status: "needs_input", note: "The suggested answer was not one of the form's choices." });
  expect(settled[1]).toMatchObject({ status: "checking", answer: "aws; Docker" });
});

test("needs_input keeps the model's draft and reason; an asset keeps what covers it", () => {
  const settled = settleAnswers(
    [question(1), question(2)],
    [
      { position: 1, status: "needs_input", answer: "I expect [amount] a month.", note: "No salary for on-site roles is stored." },
      { position: 2, status: "asset_needed", answer: "full_stack CV", note: "Upload your CV." },
    ],
  );

  expect(settled).toEqual([
    { id: "q1", status: "needs_input", answer: "I expect [amount] a month.", note: "No salary for on-site roles is stored." },
    { id: "q2", status: "asset_needed", answer: "full_stack CV", note: "Upload your CV." },
  ]);
});

test("the check removes an answer it cannot support and keeps the rest", () => {
  const problems = new Map([[1, "The profile shows no Laravel work."]]);

  expect(afterCheck({ ...question(1), answer: "Yes" }, problems)).toEqual({
    id: "q1",
    status: "needs_input",
    answer: null,
    note: "The suggested answer was not supported: The profile shows no Laravel work.",
  });
  expect(afterCheck({ ...question(2), answer: "Yes" }, problems)).toEqual({ id: "q2", status: "answered", answer: "Yes", note: null });
});
