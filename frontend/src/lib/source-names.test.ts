import { expect, test } from "vitest";
import { NIGHTLY_SOURCES, sourceName } from "./source-names";

test("names a known source, and shows any other as it is stored", () => {
  expect(sourceName("himalayas")).toBe("Himalayas");
  expect(sourceName("hackernews")).toBe("Hacker News");
  expect(sourceName("somewhere")).toBe("somewhere");
});

test("lists every nightly source with its site, for the credit on the Jobs page", () => {
  expect(NIGHTLY_SOURCES).toEqual([
    { name: "Himalayas", site: "https://himalayas.app" },
    { name: "Hacker News", site: "https://news.ycombinator.com" },
  ]);
});
