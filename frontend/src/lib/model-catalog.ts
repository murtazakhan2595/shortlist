// The model steps, providers, effort levels and the models the app may use, with their prices.
// These are constants: they change only with the code. Which model each step uses is the owner's
// choice and lives in the step_models table (B3, U4).

export const MODEL_STEPS = [
  "extract_capture",
  "write_email",
  "check_email",
  "read_form",
  "answer_form",
  "check_form_answers",
  "score_listing",
  "write_note",
  "check_note",
] as const;
export type ModelStep = (typeof MODEL_STEPS)[number];

export const MODEL_PROVIDERS = ["openai"] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type ModelPrice = { inputUsdPerMillionTokens: number; outputUsdPerMillionTokens: number };

// From each provider's own pricing page, checked on 13 October 2026 (PLAN.md section 4).
// A model that is not listed here cannot be used, so the cost of every call is known (B1).
export const MODEL_PRICES: Record<ModelProvider, Record<string, ModelPrice>> = {
  openai: {
    "gpt-6-luna": { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 },
    "gpt-6.1-sol": { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 },
  },
};

export function findModelPrice(provider: ModelProvider, model: string): ModelPrice | undefined {
  return MODEL_PRICES[provider][model];
}
