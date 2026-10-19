import { beforeEach, expect, test, vi } from "vitest";
import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("INTERNAL_API_SECRET", "a".repeat(32));
});

test("refuses a call without the internal API secret, before touching the queue", async () => {
  const response = await POST(new Request("https://app.example/api/worker", { method: "POST" }));

  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ ok: false, error: { code: "unauthorized" } });
});

test("refuses a call with the wrong secret", async () => {
  const request = new Request("https://app.example/api/worker", {
    method: "POST",
    headers: { authorization: `Bearer ${"b".repeat(32)}` },
  });

  expect((await POST(request)).status).toBe(401);
});
