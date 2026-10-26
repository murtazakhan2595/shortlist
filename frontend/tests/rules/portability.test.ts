import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import packageJson from "../../package.json";
import { codeFiles, filesMatching, repoRoot } from "./repo";

// Moving host must need only configuration changes.

const HOST_PACKAGE = /^(@vercel\/|vercel$|@netlify\/|netlify$|@aws-amplify\/|aws-amplify$)/;

describe("nothing ties the app to its host", () => {
  const files = codeFiles();

  test("no host-specific package (rule 1)", () => {
    const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });

    expect(dependencies.filter((name) => HOST_PACKAGE.test(name))).toEqual([]);
  });

  test("no vercel.json (rule 1)", () => {
    expect(existsSync(path.join(repoRoot, "vercel.json"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "frontend", "vercel.json"))).toBe(false);
  });

  test("no edge runtime (rule 2)", () => {
    expect(filesMatching(files, /export\s+const\s+runtime\s*=\s*["']edge["']/)).toEqual([]);
  });

  test("no on-demand revalidation (rule 2)", () => {
    expect(filesMatching(files, /\b(revalidatePath|revalidateTag|updateTag)\b/)).toEqual([]);
  });

  test("no work after the response is sent (rule 3)", () => {
    // event.waitUntil is standard in the browser's service worker; the rule is about the server.
    const serverFiles = files.filter((file) => file !== "frontend/public/sw.js");

    expect(
      filesMatching(serverFiles, /\bwaitUntil\b|import\s*{[^}]*\bafter\b[^}]*}\s*from\s*["']next\/server["']/),
    ).toEqual([]);
  });
});
