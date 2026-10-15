import { expect, test } from "vitest";
import { describeError } from "./errors";

test("names the error type and message", () => {
  expect(describeError(new TypeError("bad input"))).toBe("TypeError: bad input");
});

test("describes values that are not errors, and keeps descriptions short", () => {
  expect(describeError("plain text")).toBe("plain text");
  expect(describeError(new Error("x".repeat(5_000)))).toHaveLength(1_000);
});
