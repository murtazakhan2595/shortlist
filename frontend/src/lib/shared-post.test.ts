import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as sharedPost from "./shared-post";

test("the service worker uses the same names as the app (public/sw.js repeats them)", () => {
  const serviceWorker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

  for (const [name, value] of Object.entries(sharedPost)) {
    expect(serviceWorker, name).toContain(`const ${name} = "${value}";`);
  }
});
