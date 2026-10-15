import { expect, test } from "vitest";
import { AuthCallbackQuerySchema } from "./schemas";

test("sends the owner home when no path is given", () => {
  expect(AuthCallbackQuerySchema.parse({ code: "abc" }).next).toBe("/");
});

test("only redirects to paths inside the app", () => {
  expect(AuthCallbackQuerySchema.safeParse({ code: "abc", next: "/captures" }).success).toBe(true);
  expect(AuthCallbackQuerySchema.safeParse({ code: "abc", next: "https://evil.example" }).success).toBe(false);
  expect(AuthCallbackQuerySchema.safeParse({ code: "abc", next: "//evil.example" }).success).toBe(false);
});
