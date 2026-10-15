import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";
import type { EvalCheck } from "./check";
import { loadCases } from "./cases";

const check: EvalCheck<{ text: string }, unknown> = {
  id: "TEST",
  name: "Loader test",
  passBar: 1,
  caseSchema: z.object({ text: z.string() }),
  run: async () => ({}),
  grade: () => ({ pass: true, reason: "" }),
};

function folderWith(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(tmpdir(), "eval-cases-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(directory, name), content);
  return directory;
}

test("loads each JSON file as a case named after the file", () => {
  const directory = folderWith({ "b-post.json": '{"text":"two"}', "a-post.json": '{"text":"one"}', "notes.txt": "x" });

  expect(loadCases(check, directory)).toEqual([
    { id: "a-post", testCase: { text: "one" } },
    { id: "b-post", testCase: { text: "two" } },
  ]);
});

test("says where to add cases when there are none", () => {
  expect(() => loadCases(check, folderWith({}))).toThrow("No test cases for TEST");
});

test("names the case that does not match the check's schema", () => {
  expect(() => loadCases(check, folderWith({ "bad.json": '{"words":1}' }))).toThrow("Test case bad for TEST is not valid");
});
