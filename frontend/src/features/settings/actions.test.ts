import { beforeEach, expect, test, vi } from "vitest";
import { updateSettings, updateStepModel } from "./actions";

// The actions with the owner check and database replaced: the owner's real settings are never written by tests.
const db = vi.hoisted(() => ({
  updates: [] as { table: string; values: unknown; filter: [string, unknown] }[],
  found: true,
  error: null as { message: string } | null,
}));
vi.mock("@/server/auth/require-owner", () => ({
  requireOwner: async () => ({
    db: {
      from: (table: string) => ({
        update: (values: unknown) => ({
          eq: (column: string, value: unknown) => {
            db.updates.push({ table, values, filter: [column, value] });
            const result = { error: db.error };
            return Object.assign(Promise.resolve(result), {
              select: () => ({ maybeSingle: async () => ({ data: db.found ? { step: value } : null, error: db.error }) }),
            });
          },
        }),
      }),
    },
  }),
}));

beforeEach(() => {
  db.updates.length = 0;
  db.found = true;
  db.error = null;
});

const SETTINGS = {
  dailyTarget: 15,
  monthlyCapUsd: 40.5,
  payFloorUsdMonth: 3000,
  excludedCountries: ["India", "India", "Nigeria"],
  blockedCompanies: ["KDCI", "micro1", "KDCI"],
};

test("saves the nightly run's settings to the one settings row, each country and company once", async () => {
  expect((await updateSettings(SETTINGS)).ok).toBe(true);

  expect(db.updates).toEqual([
    {
      table: "settings",
      values: {
        daily_target: 15,
        monthly_cap_usd: 40.5,
        pay_floor_usd_month: 3000,
        excluded_countries: ["India", "Nigeria"],
        blocked_companies: ["KDCI", "micro1"],
      },
      filter: ["id", true],
    },
  ]);
});

test("refuses settings out of range before touching the database", async () => {
  const result = await updateSettings({ ...SETTINGS, dailyTarget: 0 });

  expect(result.ok).toBe(false);
  expect(db.updates).toEqual([]);
});

test("a database error is reported, not thrown", async () => {
  db.error = { message: "permission denied" };

  expect(await updateSettings(SETTINGS)).toEqual({
    ok: false,
    error: { code: "internal", message: "Could not save the settings: permission denied" },
  });
});

test("sets one step's model, and only a priced one (B1, B3)", async () => {
  const choice = { step: "score_listing" as const, provider: "openai" as const, model: "gpt-6.1-sol", effort: "low" as const };

  expect((await updateStepModel(choice)).ok).toBe(true);
  expect(db.updates).toEqual([{ table: "step_models", values: { provider: "openai", model: "gpt-6.1-sol", effort: "low" }, filter: ["step", "score_listing"] }]);

  expect((await updateStepModel({ ...choice, model: "unpriced" })).ok).toBe(false);
  expect(db.updates).toHaveLength(1);
});

test("a step with no model row is reported as not found", async () => {
  db.found = false;

  const result = await updateStepModel({ step: "check_email", provider: "openai", model: "gpt-6-luna", effort: "high" });

  expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
});
