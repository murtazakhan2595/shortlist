import { describe, expect, test } from "vitest";
import { codeFiles, readRepoFile } from "./repo";

// A ported file starts with a header such as:
//   // Ported from: https://github.com/owner/repo/blob/<commit>/path (MIT)
const PORTED_FROM = /Ported from:\s*(\S+)/g;

describe("reused code is credited (principle 6)", () => {
  test("every source named in a 'Ported from' header is listed in THIRD_PARTY_NOTICES.md", () => {
    const notices = readRepoFile("THIRD_PARTY_NOTICES.md");
    const uncredited = codeFiles().flatMap((file) =>
      [...readRepoFile(file).matchAll(PORTED_FROM)]
        .map(([, source]) => source)
        .filter((source) => !notices.includes(source))
        .map((source) => `${file}: ${source}`),
    );

    expect(uncredited).toEqual([]);
  });
});
