import { expect, test } from "vitest";
import { captureFingerprint } from "./writer-steps";

test("a post with a role is known by its address and role, however it is worded", () => {
  expect(captureFingerprint("hr@acme.example", "Full-Stack Engineer", "Post one")).toBe(
    captureFingerprint("HR@acme.example", "Full Stack Engineer", "Post two, reworded"),
  );
});

test("without a role, two different posts to one address are two jobs, and a reshare is the same one", () => {
  const post = "We are hiring!\n\nSend your CV to hr@acme.example";

  expect(captureFingerprint("hr@acme.example", null, post)).not.toBe(captureFingerprint("hr@acme.example", null, "Another job, same inbox"));
  expect(captureFingerprint("hr@acme.example", null, post)).toBe(captureFingerprint("hr@acme.example", null, `  ${post.replace("\n\n", " ")}`));
});
