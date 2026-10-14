import { describe, expect, test } from "vitest";
import { readRepoFile, repoFiles, textFiles } from "./repo";

// Principle 6: no secrets and no personal data in the repository.
// Secrets in file contents are caught by gitleaks in CI; this file covers env files and personal data.

const ENV_FILE = /(^|\/)\.env($|\.)/;
const ALLOWED_ENV_FILE = /(^|\/)\.env\.example$/;

/**
 * The owner's personal details (email, phone, name, ...), one per line, from the
 * PERSONAL_DATA_PATTERNS secret. The list itself never enters the repository.
 */
function personalDataPatterns(): string[] {
  return (process.env.PERSONAL_DATA_PATTERNS ?? "")
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

describe("no secrets or personal data in the repository (principle 6)", () => {
  test("no env file is committed, except .env.example", () => {
    const envFiles = repoFiles().filter((file) => ENV_FILE.test(file) && !ALLOWED_ENV_FILE.test(file));

    expect(envFiles).toEqual([]);
  });

  const patterns = personalDataPatterns();

  test("the personal data list is set in CI", () => {
    if (process.env.CI) {
      expect(patterns.length, "set the PERSONAL_DATA_PATTERNS secret in GitHub").toBeGreaterThan(0);
    }
  });

  test.skipIf(patterns.length === 0)("no file contains the owner's personal data", () => {
    const leaks = textFiles().filter((file) => {
      const content = readRepoFile(file).toLowerCase();
      return patterns.some((pattern) => content.includes(pattern));
    });

    // Only file names are reported, so a failure never prints the personal data itself.
    expect(leaks).toEqual([]);
  });
});
