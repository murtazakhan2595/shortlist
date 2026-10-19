import { describe, expect, test } from "vitest";
import { checkExtraction, type ExtractedPost, type PostInput, statusAfterReading } from "./extract-capture";

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

const textPost: PostInput = {
  kind: "text",
  text: "We are hiring a Full-Stack Engineer. Send your CV to Jobs@Acme.example or apply at https://forms.gle/abc123",
};
const screenshotPost: PostInput = { kind: "screenshots", images: [{ mimeType: "image/png", base64: "" }] };

function answer(fields: Partial<ExtractedPost>): ExtractedPost {
  return { role: null, company: null, posterName: null, contactEmail: null, formUrl: null, postText: null, ...fields };
}

describe("checkExtraction", () => {
  test("keeps an email and a form link that appear in the pasted post", () => {
    const checked = checkExtraction(
      answer({ contactEmail: "jobs@acme.example", formUrl: "https://forms.gle/abc123" }),
      textPost,
    );

    expect(checked.contactEmail).toBe("jobs@acme.example");
    expect(checked.formUrl).toBe("https://forms.gle/abc123");
  });

  test("drops an email that is not in the pasted post, so an invented one is never used", () => {
    expect(checkExtraction(answer({ contactEmail: "hr@acme.example" }), textPost).contactEmail).toBeNull();
  });

  test("drops a value that is not an email address", () => {
    expect(checkExtraction(answer({ contactEmail: "Send your CV" }), textPost).contactEmail).toBeNull();
  });

  test("keeps an email read from a screenshot, which the owner confirms before use", () => {
    expect(checkExtraction(answer({ contactEmail: "hr@acme.example" }), screenshotPost).contactEmail).toBe(
      "hr@acme.example",
    );
  });

  test("never treats a LinkedIn link as a form (C8)", () => {
    const linkedIn = answer({ formUrl: "https://www.linkedin.com/jobs/view/123" });

    expect(checkExtraction(linkedIn, screenshotPost).formUrl).toBeNull();
  });

  test("keeps the text read from screenshots, and ignores any for pasted text", () => {
    const withText = answer({ postText: "We are hiring." });

    expect(checkExtraction(withText, screenshotPost).postText).toBe("We are hiring.");
    expect(checkExtraction(withText, textPost).postText).toBeNull();
  });

  test("turns blank answers into null and trims the rest", () => {
    const checked = checkExtraction(answer({ role: "  Full-Stack Engineer ", company: "   " }), textPost);

    expect(checked.role).toBe("Full-Stack Engineer");
    expect(checked.company).toBeNull();
  });
});
