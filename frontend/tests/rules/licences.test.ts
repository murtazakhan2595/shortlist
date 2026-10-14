import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import packageJson from "../../package.json";

// Principle 6: only permissive licences.
// Packages we choose must be on the allow list. Packages those bring in must not be under a forbidden licence.

const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "PostgreSQL",
]);

// GPL and AGPL, but not LGPL; plus licences that are not open source or are missing.
const FORBIDDEN = /(^|[^L])GPL|SSPL|Commons-Clause|ODbL|BUSL|UNLICENSED|UNKNOWN/i;

type LicenceReport = Record<string, { name: string }[]>;

function packagesByLicence(): Map<string, string> {
  const output = execFileSync("pnpm", ["licenses", "list", "--json"], { encoding: "utf8" });
  const report = JSON.parse(output) as LicenceReport;
  const licenceOf = new Map<string, string>();

  for (const [licence, packages] of Object.entries(report)) {
    for (const { name } of packages) licenceOf.set(name, licence);
  }
  return licenceOf;
}

describe("dependency licences (principle 6)", () => {
  const licenceOf = packagesByLicence();

  test("every direct dependency is on the allow list", () => {
    const direct = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
    const notAllowed = direct
      .map((name) => `${name}: ${licenceOf.get(name) ?? "not found"}`)
      .filter((entry) => !ALLOWED.has(entry.split(": ")[1]));

    expect(notAllowed).toEqual([]);
  });

  test("no package is under a forbidden licence", () => {
    const forbidden = [...licenceOf]
      .filter(([, licence]) => FORBIDDEN.test(licence))
      .map(([name, licence]) => `${name}: ${licence}`);

    expect(forbidden).toEqual([]);
  });
});
