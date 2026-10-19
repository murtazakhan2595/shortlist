import { expect, test } from "vitest";
import { formatUsd } from "./format";

test("shows small costs to a hundredth of a cent, and larger ones to the cent", () => {
  expect(formatUsd(0.04193)).toBe("$0.0419");
  expect(formatUsd(0)).toBe("$0.0000");
  expect(formatUsd(12.345)).toBe("$12.35");
});
