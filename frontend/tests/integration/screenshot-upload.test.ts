import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { getAdminClient } from "@/server/supabase/admin";

// The browser uploads screenshots with a plain PUT to a one-time signed link (capture-form.tsx).

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const storage = getAdminClient().storage.from("screenshots");
const path = `captures/${randomUUID()}.png`;
const notAnImagePath = `captures/${randomUUID()}.png`;

afterAll(async () => {
  await storage.remove([path, notAnImagePath]);
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

test("the screenshots bucket refuses a file that is not an image, whatever the link allows", async () => {
  const { data, error } = await storage.createSignedUploadUrl(notAnImagePath);
  if (error) throw error;

  // A PDF, which Storage accepts by default; only the bucket's own limit refuses it.
  const put = await fetch(data.signedUrl, { method: "PUT", body: "%PDF-1.7", headers: { "content-type": "application/pdf" } });

  expect(put.ok).toBe(false);
});
