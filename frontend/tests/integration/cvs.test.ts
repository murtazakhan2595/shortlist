import { afterAll, expect, test } from "vitest";
import { createCvUploadUrl, setCurrentCv } from "@/server/cvs";
import { getAdminClient } from "@/server/supabase/admin";

// CV uploads against the real storage. The owner's current CVs are never switched here: only the refusals
// are tested. Switching the current CV is covered by supabase/tests/database/cvs.test.sql, in a transaction.
const database = getAdminClient();
const paths: string[] = [];

afterAll(async () => {
  await database.storage.from("cvs").remove(paths);
});

test("a CV gets a one-time link to a new PDF path in the cvs bucket", async () => {
  const upload = await createCvUploadUrl(database);
  paths.push(upload.path);

  expect(upload.path).toMatch(/^cvs\/[0-9a-f-]{36}\.pdf$/);
  expect(upload.signedUrl).toContain("/object/upload/sign/cvs/");
});

test("nothing becomes the current CV unless it was uploaded", async () => {
  const upload = await createCvUploadUrl(database);

  expect(await setCurrentCv(database, { variant: "full_stack", fileName: "Never-uploaded.pdf", storagePath: upload.path })).toBeNull();
});

test("the cvs bucket refuses a file that is not a PDF", async () => {
  const upload = await createCvUploadUrl(database);
  paths.push(upload.path);

  const put = await fetch(upload.signedUrl, { method: "PUT", body: "<p>not a CV</p>", headers: { "content-type": "image/png" } });

  expect(put.ok).toBe(false);
});
