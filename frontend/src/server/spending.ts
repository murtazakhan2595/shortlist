import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";

// The monthly spending cap (PLAN.md item 5.4; B2). Automated work (the nightly run: fetching, scoring and
// writing notes) stops once this month's model spending reaches the cap set in settings. Work the owner
// starts, a capture or a form, always runs.

export type SpendingCap = { spentUsd: number; capUsd: number; reached: boolean };

/** The current month in UTC, as model spending is summed ("2026-10"). */
export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** This month's model spending against the cap. Takes the owner's client in pages and the admin client in steps. */
export async function loadSpendingCap(db: SupabaseClient<Database>): Promise<SpendingCap> {
  const [settings, spend] = await Promise.all([
    db.from("settings").select("monthly_cap_usd").single(),
    db.from("monthly_spend").select("cost_usd").eq("month", currentMonth()),
  ]);
  if (settings.error) throw new Error(`Could not load the monthly cap: ${settings.error.message}`);
  if (spend.error) throw new Error(`Could not load this month's spending: ${spend.error.message}`);

  const spentUsd = spend.data.reduce((total, row) => total + (row.cost_usd ?? 0), 0);
  const capUsd = settings.data.monthly_cap_usd;
  return { spentUsd, capUsd, reached: spentUsd >= capUsd };
}
