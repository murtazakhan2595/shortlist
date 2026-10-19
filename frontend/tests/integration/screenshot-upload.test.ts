import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { getAdminClient } from "@/server/supabase/admin";

// The browser uploads screenshots with a plain PUT to a one-time signed link (capture-form.tsx).
// This proves the real storage accepts that request, and that the link works once only.

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const storage = getAdminClient().storage.from("screenshots");
const path = `captures/${randomUUID()}.png`;

afterAll(async () => {
  await storage.remove([path]);
});

test("a screenshot uploads to its signed link with a plain PUT, once", async () => {
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error) throw error;

  const put = () =>
    fetch(data.signedUrl, { method: "PUT", body: ONE_PIXEL_PNG, headers: { "content-type": "image/png" } });

  expect((await put()).ok).toBe(true);
  expect((await put()).ok).toBe(false);

  const stored = await storage.download(path);
  if (stored.error) throw stored.error;
  expect(Buffer.from(await stored.data.arrayBuffer())).toEqual(ONE_PIXEL_PNG);
});
