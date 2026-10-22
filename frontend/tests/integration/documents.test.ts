import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { saveDocumentIfChanged } from "@/server/documents";
import { getAdminClient } from "@/server/supabase/admin";

// Document versioning against the real database, on a document name only this test uses.
// (CV swapping is covered by the database tests, so the owner's real CVs are never touched.)
const database = getAdminClient();
const name = `integration-test-${randomUUID()}`;

afterAll(async () => {
  await database.from("documents").delete().eq("name", name);
});

test("adds a document, skips it when unchanged, adds a new version when it changes, and refuses a stale edit", async () => {
  const document = { kind: "voice_example" as const, name, content: "Hi Ken," };

  expect(await saveDocumentIfChanged(database, document)).toMatchObject({ status: "added", version: 1 });
  expect(await saveDocumentIfChanged(database, document)).toMatchObject({ status: "unchanged", version: 1 });
  expect(await saveDocumentIfChanged(database, { ...document, content: "Hi Ken, thanks." })).toMatchObject({
    status: "updated",
    version: 2,
  });

  // An edit that started from version 1 is refused now that version 2 exists, and saves nothing.
  expect(await saveDocumentIfChanged(database, { ...document, content: "Hi Ken!" }, 1)).toMatchObject({
    status: "conflict",
    version: 2,
  });

  const { data } = await database.from("documents").select("version").eq("name", name).order("version");
  expect(data).toEqual([{ version: 1 }, { version: 2 }]);
});
