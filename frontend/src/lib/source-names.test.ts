import { expect, test } from "vitest";
import { sourceName } from "./source-names";

test("names a known source, and shows any other as it is stored", () => {
  expect(sourceName("himalayas")).toBe("Himalayas");
  expect(sourceName("hackernews")).toBe("hackernews");
});
