import { expect, test } from "vitest";
import { questionsFromGreenhouse, questionsToAdd } from "./read-form";

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

test("Greenhouse questions are written as a read form's are, and a list of every country is left to the owner", () => {
  const countries = Array.from({ length: 200 }, (_, index) => ({ label: `Country ${index}` }));
  expect(
    questionsFromGreenhouse([
      { label: "Resume/CV", required: true, description: null, fields: [{ type: "input_file", values: [] }] },
      { label: "Why us?", required: false, description: "<p>A few lines is <b>plenty</b>.</p>", fields: [{ type: "textarea", values: [] }] },
      { label: "Do you need a visa?", required: true, description: null, fields: [{ type: "multi_value_single_select", values: [{ label: "Yes" }, { label: "No" }] }] },
      { label: "Where do you live?", required: true, description: null, fields: [{ type: "multi_value_single_select", values: countries }] },
    ]),
  ).toEqual([
    { question: "Resume/CV *", options: [] },
    { question: "Why us?\nA few lines is plenty.", options: [] },
    { question: "Do you need a visa? *", options: ["Yes", "No"] },
    { question: "Where do you live? *\n(Chosen from a list.)", options: [] },
  ]);
});
