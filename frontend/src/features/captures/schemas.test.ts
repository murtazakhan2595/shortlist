import { describe, expect, test } from "vitest";
import { MAX_SCREENSHOTS_PER_CAPTURE, SubmitCaptureInputSchema } from "./schemas";

const imagePath = (n: number) => `captures/0f8fad5b-d9cb-469f-a165-70867728950${n}.png`;

describe("SubmitCaptureInputSchema", () => {
  test("accepts pasted text, trimmed", () => {
    const result = SubmitCaptureInputSchema.parse({ inputType: "text", text: "  We are hiring  " });

    expect(result).toEqual({ inputType: "text", text: "We are hiring" });
  });

  test("accepts screenshots with an optional post link", () => {
    const input = {
      inputType: "screenshot",
      imagePaths: [imagePath(1)],
      postUrl: "https://www.linkedin.com/posts/example",
    };

    expect(SubmitCaptureInputSchema.safeParse(input).success).toBe(true);
  });

  test("rejects empty text, no screenshots, and too many screenshots", () => {
    const tooMany = Array.from({ length: MAX_SCREENSHOTS_PER_CAPTURE + 1 }, (_, n) => imagePath(n));

    expect(SubmitCaptureInputSchema.safeParse({ inputType: "text", text: "   " }).success).toBe(false);
    expect(SubmitCaptureInputSchema.safeParse({ inputType: "screenshot", imagePaths: [] }).success).toBe(false);
    expect(SubmitCaptureInputSchema.safeParse({ inputType: "screenshot", imagePaths: tooMany }).success).toBe(false);
  });

  test("rejects a screenshot path outside the captures folder", () => {
    const input = { inputType: "screenshot", imagePaths: ["cvs/0f8fad5b-d9cb-469f-a165-70867728950e.pdf"] };

    expect(SubmitCaptureInputSchema.safeParse(input).success).toBe(false);
  });
});
