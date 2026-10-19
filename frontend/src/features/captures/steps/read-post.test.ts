import { describe, expect, test } from "vitest";
import { type ExtractedPost, type PostInput, checkExtraction } from "./read-post";

const textPost: PostInput = {
  kind: "text",
  text: "We are hiring a Full-Stack Engineer. Send your CV to Jobs@Acme.example or apply at https://forms.gle/abc123",
};
const screenshotPost: PostInput = { kind: "screenshots", images: [{ mimeType: "image/png", base64: "" }] };

function answer(fields: Partial<ExtractedPost>): ExtractedPost {
  return { role: null, company: null, posterName: null, contactEmail: null, formUrl: null, ...fields };
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

  test("turns blank answers into null and trims the rest", () => {
    const checked = checkExtraction(answer({ role: "  Full-Stack Engineer ", company: "   " }), textPost);

    expect(checked.role).toBe("Full-Stack Engineer");
    expect(checked.company).toBeNull();
  });
});
