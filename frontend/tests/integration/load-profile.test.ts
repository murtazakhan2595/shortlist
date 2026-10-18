import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { getAdminClient } from "@/server/supabase/admin";
import { saveDocumentIfChanged } from "../../scripts/load-profile";

// Document versioning against the real database, on a document name only this test uses.
// (CV swapping is covered by the database tests, so the owner's real CVs are never touched.)
const database = getAdminClient();
const name = `integration-test-${randomUUID()}`;

afterAll(async () => {
  await database.from("documents").delete().eq("name", name);
});

test("adds a document, skips it when unchanged, and adds a new version when it changes", async () => {
  const document = { kind: "voice_example" as const, name, content: "Hi Ken," };

  expect(await saveDocumentIfChanged(database, document)).toEqual({ status: "added", version: 1 });
  expect(await saveDocumentIfChanged(database, document)).toEqual({ status: "unchanged", version: 1 });
  expect(await saveDocumentIfChanged(database, { ...document, content: "Hi Ken, thanks." })).toEqual({
    status: "updated",
    version: 2,
  });

  const { data } = await database.from("documents").select("version").eq("name", name).order("version");
  expect(data).toEqual([{ version: 1 }, { version: 2 }]);
});
