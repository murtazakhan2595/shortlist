import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|sql)$/;
const BINARY_FILE = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf)$/i;
const RULE_TESTS_DIR = "frontend/tests/rules/";

/**
 * Every file in the repository that git tracks or would track,
 * including new files not yet committed, as paths relative to the repo root.
 */
export function repoFiles(): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file && existsSync(path.join(repoRoot, file)));
}

/** Source files the rules apply to. The rule tests themselves are left out, since they name what they forbid. */
export function codeFiles(): string[] {
  return repoFiles().filter((file) => CODE_FILE.test(file) && !file.startsWith(RULE_TESTS_DIR));
}

export function textFiles(): string[] {
  return repoFiles().filter((file) => !BINARY_FILE.test(file));
}

export function readRepoFile(file: string): string {
  return readFileSync(path.join(repoRoot, file), "utf8");
}

/** The files whose content matches the pattern. */
export function filesMatching(files: string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(readRepoFile(file)));
}
