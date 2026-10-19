import { beforeEach, expect, test, vi } from "vitest";
import { isInternalCaller } from "./internal-caller";

const SECRET = "s".repeat(40);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("INTERNAL_API_SECRET", SECRET);
});

function requestWith(authorization?: string): Request {
  return new Request("https://app.example/api/worker", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

test("accepts the internal API secret as a Bearer token", () => {
  expect(isInternalCaller(requestWith(`Bearer ${SECRET}`))).toBe(true);
});

test("refuses a missing, wrong or partial secret", () => {
  expect(isInternalCaller(requestWith())).toBe(false);
  expect(isInternalCaller(requestWith(`Bearer ${"x".repeat(40)}`))).toBe(false);
  expect(isInternalCaller(requestWith(`Bearer ${SECRET.slice(0, 10)}`))).toBe(false);
});
