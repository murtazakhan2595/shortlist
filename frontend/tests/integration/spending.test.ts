import { expect, test } from "vitest";
import { currentMonth, loadSpendingCap } from "@/server/spending";
import { getAdminClient } from "@/server/supabase/admin";

// Reads only: the real month's spending and cap, checked against model_calls summed here. Other test files
// add and remove small fake-model calls meanwhile, so the two sums may differ by a few cents.
test("this month's spending is the sum of this month's model calls, compared with the cap in settings", async () => {
  const database = getAdminClient();
  const start = `${currentMonth()}-01T00:00:00Z`;
  const [calls, settings, cap] = await Promise.all([
    database.from("model_calls").select("cost_usd").gte("created_at", start),
    database.from("settings").select("monthly_cap_usd").single(),
    loadSpendingCap(database),
  ]);
  if (calls.error) throw calls.error;
  if (settings.error) throw settings.error;

  const spent = calls.data.reduce((total, call) => total + call.cost_usd, 0);
  expect(Math.abs(cap.spentUsd - spent)).toBeLessThan(0.5);
  expect(cap.capUsd).toBe(settings.data.monthly_cap_usd);
  expect(cap.reached).toBe(cap.spentUsd >= cap.capUsd);
});
