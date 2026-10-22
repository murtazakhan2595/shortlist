import { expect, test } from "vitest";
import { escapeRegExp } from "./regex";

test("a name with brackets and dots matches only itself", () => {
  const pattern = new RegExp(`^${escapeRegExp("Congo (D.R.C.)")}$`);

  expect(pattern.test("Congo (D.R.C.)")).toBe(true);
  expect(pattern.test("Congo xD.R.C.x")).toBe(false);
});

test("an unbalanced bracket no longer breaks the expression", () => {
  expect(() => new RegExp(escapeRegExp("Saint [Kitts"))).not.toThrow();
});
