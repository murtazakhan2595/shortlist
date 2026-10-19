import { expect, test } from "vitest";
import type { EmailDraft } from "@/features/applications/steps/draft-checks";
import { gradeDraft } from "./writer";

const draft: EmailDraft = {
  cvVariant: "full_stack",
  presentedTitle: "Full-Stack Developer",
  emailPattern: "post-reply",
  subject: "Application for Node.js Developer",
  body: "Hi team, I am applying for the Node.js Developer role.",
  signature: "Regards",
};
const expected = { contactEmail: "hr@acme.example", role: "Node.js Developer", cvVariant: "full_stack" };

test("passes a ready draft that names the role and attaches the expected CV", () => {
  expect(gradeDraft({ draft, problems: [], drafts: 1 }, expected)).toEqual({ pass: true, reason: "" });
});

test("fails a draft with the wrong CV or without the role", () => {
  const grade = gradeDraft({ draft: { ...draft, cvVariant: "ai_engineer", subject: "Hello", body: "Hi" }, problems: [], drafts: 1 }, expected);

  expect(grade).toEqual({ pass: false, reason: 'role "Node.js Developer" not named; CV ai_engineer, expected full_stack' });
});

test("fails a blocked draft, with its problems as the reason", () => {
  expect(gradeDraft({ draft, problems: ["the number 9"], drafts: 3 }, expected)).toEqual({
    pass: false,
    reason: "blocked: the number 9",
  });
});
