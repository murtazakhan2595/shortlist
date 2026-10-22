import "server-only";
import { MODEL_STEPS, type ModelStep } from "@/lib/model-catalog";
import { requireOwner } from "@/server/auth/require-owner";
import { isGmailConnected } from "@/server/gmail/gmail";
import { currentMonth, loadSpendingCap, type SpendingCap } from "@/server/spending";
import { type UpdateSettingsInput, type UpdateStepModelInput, UpdateStepModelInputSchema } from "./schemas";

// Data Access Layer for settings: the feature's reads, each starting with the owner check.

/** True once the owner has allowed Gmail drafts (X1). */
export async function getGmailConnected(): Promise<boolean> {
  await requireOwner();
  return isGmailConnected();
}

/** One month's model spending, in total and per step (B1). Months are "YYYY-MM", in UTC. */
export type MonthlySpend = {
  /** Every month with spending, newest first; the current month is always included. */
  months: string[];
  month: string;
  totalUsd: number;
  calls: number;
  steps: { step: string; calls: number; costUsd: number }[];
};

/** The spending for a month, or for the current month when none, or an unknown one, is asked for. */
export async function getMonthlySpend(requestedMonth: string | undefined): Promise<MonthlySpend> {
  const { db } = await requireOwner();
  const { data, error } = await db.from("monthly_spend").select("month, step, calls, cost_usd");
  if (error) throw new Error(`Could not load monthly spending: ${error.message}`);

  const thisMonth = currentMonth();
  const months = [...new Set([thisMonth, ...data.flatMap((row) => (row.month ? [row.month] : []))])].sort().reverse();
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : thisMonth;

  const steps = data
    .filter((row) => row.month === month)
    .map((row) => ({ step: row.step ?? "unknown", calls: row.calls ?? 0, costUsd: row.cost_usd ?? 0 }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    months,
    month,
    totalUsd: steps.reduce((total, step) => total + step.costUsd, 0),
    calls: steps.reduce((total, step) => total + step.calls, 0),
    steps,
  };
}

/** This month's model spending against the monthly cap (B2). */
export async function getSpendingCap(): Promise<SpendingCap> {
  const { db } = await requireOwner();
  return loadSpendingCap(db);
}

/** The settings of the nightly run, as the settings form edits them (U4). */
export async function getRunSettings(): Promise<UpdateSettingsInput> {
  const { db } = await requireOwner();
  const { data, error } = await db
    .from("settings")
    .select("daily_target, monthly_cap_usd, pay_floor_usd_month, excluded_countries")
    .single();
  if (error) throw new Error(`Could not load the settings: ${error.message}`);
  return {
    dailyTarget: data.daily_target,
    monthlyCapUsd: data.monthly_cap_usd,
    payFloorUsdMonth: data.pay_floor_usd_month,
    excludedCountries: data.excluded_countries,
  };
}

/** The model each step uses (B3, U4), in the order the steps run. */
export async function getStepModels(): Promise<UpdateStepModelInput[]> {
  const { db } = await requireOwner();
  const { data, error } = await db.from("step_models").select("step, provider, model, effort");
  if (error) throw new Error(`Could not load the model of each step: ${error.message}`);

  // Rows come from the database, so only known steps, providers and efforts are passed on.
  return MODEL_STEPS.flatMap((step: ModelStep) => {
    const parsed = UpdateStepModelInputSchema.safeParse(data.find((row) => row.step === step));
    return parsed.success ? [parsed.data] : [];
  });
}
