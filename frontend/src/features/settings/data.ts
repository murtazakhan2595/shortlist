import "server-only";
import { MODEL_STEPS, type ModelStep } from "@/lib/model-catalog";
import { requireOwner } from "@/server/auth/require-owner";
import { isGmailConnected } from "@/server/gmail/gmail";
import { loadSpendingCap, type SpendingCap } from "@/server/spending";
import { type UpdateSettingsInput, type UpdateStepModelInput, UpdateStepModelInputSchema } from "./schemas";

export async function getGmailConnected(): Promise<boolean> {
  await requireOwner();
  return isGmailConnected();
}

export async function getSpendingCap(): Promise<SpendingCap> {
  const { db } = await requireOwner();
  return loadSpendingCap(db);
}

export async function getRunSettings(): Promise<UpdateSettingsInput> {
  const { db } = await requireOwner();
  const { data, error } = await db
    .from("settings")
    .select("daily_target, monthly_cap_usd, pay_floor_usd_month, min_score, excluded_countries, blocked_companies")
    .single();
  if (error) throw new Error(`Could not load the settings: ${error.message}`);
  return {
    dailyTarget: data.daily_target,
    monthlyCapUsd: data.monthly_cap_usd,
    payFloorUsdMonth: data.pay_floor_usd_month,
    minScore: data.min_score,
    excludedCountries: data.excluded_countries,
    blockedCompanies: data.blocked_companies,
  };
}

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
