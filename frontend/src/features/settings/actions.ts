"use server";

import { fail, ok, type Result } from "@/lib/result";
import { requireOwner } from "@/server/auth/require-owner";
import {
  type UpdateSettingsInput,
  UpdateSettingsInputSchema,
  type UpdateStepModelInput,
  UpdateStepModelInputSchema,
} from "./schemas";

// Server Actions for settings (contracts in ./schemas.ts; U4). Writes use the owner's client, so the
// access rules apply too. Each takes effect from the next step that reads it: no restart is needed.

/** Saves the nightly run's settings: jobs a night, monthly cap, lowest pay and excluded countries. */
export async function updateSettings(request: UpdateSettingsInput): Promise<Result<UpdateSettingsInput>> {
  const input = UpdateSettingsInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { dailyTarget, monthlyCapUsd, payFloorUsdMonth, excludedCountries } = input.data;
  const { error } = await db
    .from("settings")
    .update({
      daily_target: dailyTarget,
      monthly_cap_usd: monthlyCapUsd,
      pay_floor_usd_month: payFloorUsdMonth,
      // Each country once, as the filter compares names exactly.
      excluded_countries: [...new Set(excludedCountries)],
    })
    // The table has one row, whose id is always true.
    .eq("id", true);
  if (error) return fail("internal", `Could not save the settings: ${error.message}`);
  return ok(input.data);
}

/** Sets the model and reasoning effort one step uses (B3). Only a model with a known price can be chosen. */
export async function updateStepModel(request: UpdateStepModelInput): Promise<Result<UpdateStepModelInput>> {
  const input = UpdateStepModelInputSchema.safeParse(request);
  if (!input.success) return fail("invalid_input", input.error.issues[0].message);

  const { db } = await requireOwner();
  const { step, provider, model, effort } = input.data;
  const { data, error } = await db.from("step_models").update({ provider, model, effort }).eq("step", step).select("step").maybeSingle();
  if (error) return fail("internal", `Could not save the model: ${error.message}`);
  if (!data) return fail("not_found", `No model is set up for the step ${step}`);
  return ok(input.data);
}
