import { expect, test } from "vitest";
import { GmailCallbackQuerySchema } from "./schemas";

test("accepts Google's code, or its error when consent is refused", () => {
  expect(GmailCallbackQuerySchema.safeParse({ code: "4/abc", state: "s1" }).success).toBe(true);
  expect(GmailCallbackQuerySchema.safeParse({ error: "access_denied", state: "s1" }).success).toBe(true);
});

test("rejects a callback without state", () => {
  expect(GmailCallbackQuerySchema.safeParse({ code: "4/abc" }).success).toBe(false);
});
