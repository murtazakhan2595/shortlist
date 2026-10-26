import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";

// The cap stops only automated (nightly) work; a capture or form the owner starts always runs.

export type SpendingCap = { spentUsd: number; capUsd: number; reached: boolean };

/** UTC, as monthly_spend sums it: "2026-10". */
export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

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
