import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EvalCheck } from "./check";

// Test cases are kept out of the repository: private/evals/<check id>/cases/*.json,
// one case per file, named after the case.
const PRIVATE_DIRECTORY = fileURLToPath(new URL("../../private", import.meta.url));
const PRIVATE_EVALS_DIRECTORY = path.join(PRIVATE_DIRECTORY, "evals");

export type LoadedCase<Case> = { id: string; testCase: Case };

/** Reads a file a case refers to, such as a saved post. Paths in cases are relative to private/. */
export function readPrivateFile(relativePath: string): Buffer {
  return readFileSync(path.join(PRIVATE_DIRECTORY, relativePath));
}

export function casesDirectory(checkId: string): string {
  return path.join(PRIVATE_EVALS_DIRECTORY, checkId, "cases");
}

export function loadCases<Case>(
  check: EvalCheck<Case, unknown>,
  directory = casesDirectory(check.id),
): LoadedCase<Case>[] {
  const files = existsSync(directory) ? readdirSync(directory).filter((file) => file.endsWith(".json")) : [];
  if (files.length === 0) throw new Error(`No test cases for ${check.id}: add .json files to ${directory}`);

  return files.sort().map((file) => {
    const id = path.basename(file, ".json");
    const parsed = check.caseSchema.safeParse(JSON.parse(readFileSync(path.join(directory, file), "utf8")));
    if (!parsed.success) throw new Error(`Test case ${id} for ${check.id} is not valid: ${parsed.error.message}`);
    return { id, testCase: parsed.data };
  });
}
