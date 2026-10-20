import { expect, test } from "vitest";
import { AddFormPagesInputSchema, AnswerFormQuestionInputSchema } from "./schemas";

test("an owner's answer is saved to the answer bank unless they say otherwise", () => {
  const input = { formAnswerId: "0f8fad5b-d9cb-469f-a165-70867728950e", answer: "Two weeks" };

  expect(AnswerFormQuestionInputSchema.parse(input).saveToAnswerBank).toBe(true);
});

test("pages without a form start a new one; only paths the server created are accepted", () => {
  const imagePath = "forms/0f8fad5b-d9cb-469f-a165-70867728950e.png";

  expect(AddFormPagesInputSchema.safeParse({ pages: { inputType: "screenshot", imagePaths: [imagePath] } }).success).toBe(true);
  expect(
    AddFormPagesInputSchema.safeParse({ pages: { inputType: "screenshot", imagePaths: ["captures/../cvs/x.pdf"] } }).success,
  ).toBe(false);
});
