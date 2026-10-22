import { expect, test } from "vitest";
import { replyRates } from "./data";

test("counts what was sent, replied to and led to an interview, per source and per pattern", () => {
  const rates = replyRates([
    { source: "LinkedIn", pattern: "post-reply", status: "sent" },
    { source: "LinkedIn", pattern: "post-reply", status: "replied" },
    { source: "LinkedIn", pattern: "proof-first-cold-email", status: "interview" },
    { source: "Himalayas", pattern: "job-board-note", status: "replied" },
    { source: "Forms", pattern: null, status: "sent" },
  ]);

  expect(rates.bySource).toEqual([
    { name: "LinkedIn", sent: 3, replied: 2, interviews: 1 },
    { name: "Forms", sent: 1, replied: 0, interviews: 0 },
    { name: "Himalayas", sent: 1, replied: 1, interviews: 0 },
  ]);
  // A form has no email pattern, so it is counted by source only.
  expect(rates.byPattern).toEqual([
    { name: "post-reply", sent: 2, replied: 1, interviews: 0 },
    { name: "job-board-note", sent: 1, replied: 1, interviews: 0 },
    { name: "proof-first-cold-email", sent: 1, replied: 1, interviews: 1 },
  ]);
});
