import { expect, test } from "vitest";
import { fail, ok } from "./result";

test("ok wraps data", () => {
  expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
});

test("fail carries a code and a message", () => {
  expect(fail("not_found", "No such capture")).toEqual({
    ok: false,
    error: { code: "not_found", message: "No such capture" },
  });
});
