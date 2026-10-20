import { expect, test } from "vitest";
import { AddFormPagesInputSchema, AnswerFormQuestionInputSchema } from "./schemas";

test("an owner's answer is saved to the answer bank unless they say otherwise", () => {
  const input = { formAnswerId: "0f8fad5b-d9cb-469f-a165-70867728950e", answer: "Two weeks" };

  expect(AnswerFormQuestionInputSchema.parse(input).saveToAnswerBank).toBe(true);
});

test("an answer that still has a draft's guess in [brackets] is refused", () => {
  const input = { formAnswerId: "0f8fad5b-d9cb-469f-a165-70867728950e", answer: "My laptop has [16 GB RAM]." };

  expect(AnswerFormQuestionInputSchema.safeParse(input).error?.issues[0].message).toBe(
    "Replace the guesses in [brackets] with your own answer first",
  );
});

test("pages without a form start a new one; only paths the server created are accepted", () => {
  const imagePath = "forms/0f8fad5b-d9cb-469f-a165-70867728950e.png";

  expect(AddFormPagesInputSchema.safeParse({ pages: { inputType: "screenshot", imagePaths: [imagePath] } }).success).toBe(true);
  expect(
    AddFormPagesInputSchema.safeParse({ pages: { inputType: "screenshot", imagePaths: ["captures/../cvs/x.pdf"] } }).success,
  ).toBe(false);
});
