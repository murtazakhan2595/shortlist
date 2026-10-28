import { z } from "zod";
import { findModelPrice, MODEL_PROVIDERS, MODEL_STEPS, REASONING_EFFORTS } from "@/lib/model-catalog";

// Server Actions:
//   updateSettings(UpdateSettingsInput)   -> Result<UpdateSettingsInput>
//   updateStepModel(UpdateStepModelInput) -> Result<UpdateStepModelInput>

export const UpdateSettingsInputSchema = z.object({
  dailyTarget: z.int().min(1).max(100),
  monthlyCapUsd: z.number().min(0).max(1_000),
  payFloorUsdMonth: z.int().min(0),
  minScore: z.int().min(0).max(100),
  excludedCountries: z.array(z.string().trim().min(1)).max(50),
  blockedCompanies: z.array(z.string().trim().min(1).max(200)).max(500),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

// Only a model with a known price can be chosen, so every call's cost can be recorded.
export const UpdateStepModelInputSchema = z
  .object({
    step: z.enum(MODEL_STEPS),
    provider: z.enum(MODEL_PROVIDERS),
    model: z.string().trim().min(1),
    effort: z.enum(REASONING_EFFORTS),
  })
  .refine((input) => findModelPrice(input.provider, input.model) !== undefined, {
    message: "This model has no known price",
    path: ["model"],
  });
export type UpdateStepModelInput = z.infer<typeof UpdateStepModelInputSchema>;
