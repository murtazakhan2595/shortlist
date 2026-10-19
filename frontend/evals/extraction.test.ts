import { expect, test } from "vitest";
import type { ExtractedPost } from "@/features/captures/steps/read-post";
import { gradeExtraction } from "./extraction";

const expected: ExtractedPost = {
  role: "Full-Stack Engineer",
  company: "Acme",
  posterName: null,
  contactEmail: "jobs@acme.example",
  formUrl: null,
  postText: null,
};

test("passes when the email and form link match, ignoring letter case", () => {
  expect(gradeExtraction({ ...expected, contactEmail: "Jobs@Acme.example" }, expected)).toEqual({ pass: true, reason: "" });
});

test("fails on a wrong or missing email", () => {
  expect(gradeExtraction({ ...expected, contactEmail: "job@acme.example" }, expected).pass).toBe(false);
  expect(gradeExtraction({ ...expected, contactEmail: null }, expected).pass).toBe(false);
});

test("fails on a form link where the post has none", () => {
  expect(gradeExtraction({ ...expected, formUrl: "https://forms.gle/x" }, expected).pass).toBe(false);
});

test("passes with a different role, but says so", () => {
  const grade = gradeExtraction({ ...expected, role: "Engineer" }, expected);

  expect(grade.pass).toBe(true);
  expect(grade.reason).toContain("role");
});
