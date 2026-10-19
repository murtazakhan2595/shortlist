import { expect, test } from "vitest";
import { statusAfterReading } from "./extract-capture";
import type { ExtractedPost } from "./read-post";

const nothing: ExtractedPost = {
  role: null,
  company: null,
  posterName: null,
  contactEmail: null,
  formUrl: null,
  postText: null,
};
const withEmail = { ...nothing, contactEmail: "jobs@acme.example" };
const withForm = { ...nothing, formUrl: "https://forms.gle/abc123" };

test("an email from pasted text goes straight on to writing", () => {
  expect(statusAfterReading(withEmail, "text")).toBe("processing");
});

test("an email read from a screenshot waits for the owner to confirm it (C4)", () => {
  expect(statusAfterReading(withEmail, "screenshots")).toBe("awaiting_confirmation");
});

test("an email wins over a form link", () => {
  expect(statusAfterReading({ ...withEmail, formUrl: withForm.formUrl }, "text")).toBe("processing");
});

test("a form link without an email needs the form's screenshots", () => {
  expect(statusAfterReading(withForm, "text")).toBe("needs_form");
});

test("a post with neither is reported to the owner", () => {
  expect(statusAfterReading(nothing, "screenshots")).toBe("no_contact");
});
