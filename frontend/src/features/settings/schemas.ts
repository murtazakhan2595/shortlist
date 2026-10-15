import { z } from "zod";

// Contracts for the settings feature (PLAN.md item 1.3; U4).
//
// Server Actions:
//   updateSettings(UpdateSettingsInput) -> Result<UpdateSettingsInput>

export const UpdateSettingsInputSchema = z.object({
  dailyTarget: z.int().min(1).max(100),
  monthlyCapUsd: z.number().min(0).max(1_000),
  payFloorUsdMonth: z.int().min(0),
  excludedCountries: z.array(z.string().trim().min(1)).max(50),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;
