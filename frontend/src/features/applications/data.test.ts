import { expect, test } from "vitest";
import { applicationHref } from "./data";

const row = { id: "app-1", capture_id: null, listing_id: null };

test("each application opens the page that shows the job it was for", () => {
  expect(applicationHref("form", { ...row, listing_id: "job-1" })).toBe("/forms/app-1");
  expect(applicationHref("email", { ...row, capture_id: "cap-1" })).toBe("/captures/cap-1");
  expect(applicationHref("email", { ...row, listing_id: "job-1" })).toBe("/jobs/job-1");
  expect(applicationHref("note", { ...row, listing_id: "job-1" })).toBe("/jobs/job-1");
  expect(applicationHref("email", row)).toBe("/jobs");
});
