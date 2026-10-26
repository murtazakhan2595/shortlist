import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|sql)$/;
const BINARY_FILE = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf)$/i;
const RULE_TESTS_DIR = "frontend/tests/rules/";

// Includes new files not yet committed. Paths are relative to the repo root.
export function repoFiles(): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file && existsSync(path.join(repoRoot, file)));
}

// The rule tests themselves are left out, since they name what they forbid.
export function codeFiles(): string[] {
  return repoFiles().filter((file) => CODE_FILE.test(file) && !file.startsWith(RULE_TESTS_DIR));
}

export function textFiles(): string[] {
  return repoFiles().filter((file) => !BINARY_FILE.test(file));
}

export function readRepoFile(file: string): string {
  return readFileSync(path.join(repoRoot, file), "utf8");
}

export function filesMatching(files: string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(readRepoFile(file)));
}
