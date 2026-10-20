import { expect, test } from "vitest";
import { questionsToAdd } from "./read-form";

test("a question an earlier page gave is not added again, whatever its case, spacing or asterisk", () => {
  const read = [
    { question: "Your  name *", options: [] },
    { question: "Do you have Docker experience?", options: [" Yes ", "No", " "] },
  ];

  expect(questionsToAdd(read, ["your name"])).toEqual([{ question: "Do you have Docker experience?", options: ["Yes", "No"] }]);
});

test("a page that lists a question twice gives it once, and empty ones are dropped", () => {
  const read = [
    { question: "Notice period?", options: [] },
    { question: "  ", options: [] },
    { question: "notice period?", options: [] },
  ];

  expect(questionsToAdd(read, [])).toEqual([{ question: "Notice period?", options: [] }]);
});
