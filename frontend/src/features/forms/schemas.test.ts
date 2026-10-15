import { expect, test } from "vitest";
import { AnswerFormQuestionInputSchema } from "./schemas";

test("an owner's answer is saved to the answer bank unless they say otherwise", () => {
  const input = { formAnswerId: "0f8fad5b-d9cb-469f-a165-70867728950e", answer: "Two weeks" };

  expect(AnswerFormQuestionInputSchema.parse(input).saveToAnswerBank).toBe(true);
});
