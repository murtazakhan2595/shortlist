import { expect, test } from "vitest";
import { withFormAnswer } from "./documents";

const BANK = "# Answer bank\n\n## 1. Contact\n\nName: Sam\n";

test("the first answer from a form starts its own section at the end", () => {
  expect(withFormAnswer(BANK, "Spoken English out of 10?", "8")).toBe(
    "# Answer bank\n\n## 1. Contact\n\nName: Sam\n\n## Answers given on forms\n\nThe owner's own answers to form questions, saved from the app.\n\n- Question: Spoken English out of 10?\n  Answer: 8\n",
  );
});

test("a later answer is added to the section, and one to the same question replaces the old one", () => {
  let bank = withFormAnswer(BANK, "Spoken English out of 10?", "8");
  bank = withFormAnswer(bank, "Notice period?", "Two weeks");
  bank = withFormAnswer(bank, "Spoken English out of 10?", "9");

  expect(bank.match(/Spoken English/g)).toHaveLength(1);
  expect(bank.trimEnd().endsWith("- Question: Notice period?\n  Answer: Two weeks\n- Question: Spoken English out of 10?\n  Answer: 9")).toBe(true);
});

test("the section stays where the owner moved it, and answers keep to one line", () => {
  const bank = `${withFormAnswer(BANK, "Notice period?", "Two weeks")}\n## 9. Assets\n\nVideo: none\n`;

  const updated = withFormAnswer(bank, "Why us?", "Your product.\n\nYour team.");

  expect(updated).toContain("  Answer: Two weeks\n- Question: Why us?\n  Answer: Your product. Your team.\n\n## 9. Assets");
});
