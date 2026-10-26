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

test("an email goes straight on to writing, from pasted text or a screenshot", () => {
  expect(statusAfterReading(withEmail)).toBe("processing");
});

test("an email wins over a form link", () => {
  expect(statusAfterReading({ ...withEmail, formUrl: withForm.formUrl })).toBe("processing");
});

test("a form link without an email needs the form's screenshots", () => {
  expect(statusAfterReading(withForm)).toBe("needs_form");
});

test("a post with neither is reported to the owner", () => {
  expect(statusAfterReading(nothing)).toBe("no_contact");
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

  test("keeps an email read from a screenshot when it is in the text read from it", () => {
    const read = answer({ contactEmail: "hr@acme.example", postText: "We are hiring. Write to HR@acme.example." });

    expect(checkExtraction(read, screenshotPost).contactEmail).toBe("hr@acme.example");
  });

  test("drops a screenshot's email or link that its text does not contain, or when no text was read", () => {
    const elsewhere = answer({ contactEmail: "hr@acme.example", formUrl: "https://forms.gle/x", postText: "We are hiring." });
    const noText = answer({ contactEmail: "hr@acme.example", formUrl: "https://forms.gle/x" });

    for (const read of [elsewhere, noText]) {
      const checked = checkExtraction(read, screenshotPost);
      expect(checked.contactEmail).toBeNull();
      expect(checked.formUrl).toBeNull();
    }
  });

  test("never treats a LinkedIn link as a form", () => {
    const linkedIn = answer({ formUrl: "https://www.linkedin.com/jobs/view/123" });

    expect(checkExtraction(linkedIn, screenshotPost).formUrl).toBeNull();
  });

  test("keeps the text read from screenshots, and ignores any for pasted text", () => {
    const withText = answer({ postText: "We are hiring." });

    expect(checkExtraction(withText, screenshotPost).postText).toBe("We are hiring.");
    expect(checkExtraction(withText, textPost).postText).toBeNull();
  });

  test("keeps an email written in bold Unicode letters, and gives every value in plain letters", () => {
    const boldPost: PostInput = { kind: "text", text: "Send your CV to 𝗵𝗶𝗿𝗶𝗻𝗴@𝗷𝗼𝗯𝘀.𝗲𝘅𝗮𝗺𝗽𝗹𝗲.𝗰𝗼𝗺 today." };

    const fromPlain = checkExtraction(answer({ contactEmail: "hiring@jobs.example.com", role: "𝗙𝘂𝗹𝗹 𝗦𝘁𝗮𝗰𝗸 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿" }), boldPost);
    const fromBold = checkExtraction(answer({ contactEmail: "𝗵𝗶𝗿𝗶𝗻𝗴@𝗷𝗼𝗯𝘀.𝗲𝘅𝗮𝗺𝗽𝗹𝗲.𝗰𝗼𝗺" }), boldPost);

    expect(fromPlain.contactEmail).toBe("hiring@jobs.example.com");
    expect(fromPlain.role).toBe("Full Stack Developer");
    expect(fromBold.contactEmail).toBe("hiring@jobs.example.com");
    // Still word for word: a different address in bold letters is not this one.
    expect(checkExtraction(answer({ contactEmail: "hr@jobs.example.com" }), boldPost).contactEmail).toBeNull();
  });

  test("turns blank answers into null and trims the rest", () => {
    const checked = checkExtraction(answer({ role: "  Full-Stack Engineer ", company: "   " }), textPost);

    expect(checked.role).toBe("Full-Stack Engineer");
    expect(checked.company).toBeNull();
  });
});
