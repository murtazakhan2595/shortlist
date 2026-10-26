import { expect, test } from "vitest";
import { NIGHTLY_SOURCES, sourceName } from "./source-names";

test("names a known source, and shows any other as it is stored", () => {
  expect(sourceName("himalayas")).toBe("Himalayas");
  expect(sourceName("hackernews")).toBe("Hacker News");
  expect(sourceName("somewhere")).toBe("somewhere");
});

test("lists every nightly source with its name and site, for the tabs and the credit on the Jobs page", () => {
  expect(NIGHTLY_SOURCES).toEqual([
    { id: "himalayas", name: "Himalayas", site: "https://himalayas.app" },
    { id: "hackernews", name: "Hacker News", site: "https://news.ycombinator.com" },
    { id: "greenhouse", name: "Greenhouse", site: "https://www.greenhouse.com" },
    { id: "lever", name: "Lever", site: "https://www.lever.co" },
    { id: "ashby", name: "Ashby", site: "https://www.ashbyhq.com" },
  ]);
});
