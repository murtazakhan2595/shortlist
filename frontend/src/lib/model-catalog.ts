// Which model each step uses is a setting, kept in the step_models table; the options here change only with the code.

export const MODEL_STEPS = [
  "extract_capture",
  "write_email",
  "check_email",
  "read_form",
  "answer_form",
  "check_form_answers",
  "score_listing",
] as const;
export type ModelStep = (typeof MODEL_STEPS)[number];

export const MODEL_PROVIDERS = ["openai"] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type ModelPrice = {
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  cacheWriteInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

// Prices as of October 2026, from OpenAI's pricing page and prompt caching guide:
// a cache write costs 1.25 times the input price and a read 0.1 times (0.05 for gpt-6.1-sol).
// A model not listed here cannot be used, so every call's cost is known.
export const MODEL_PRICES: Record<ModelProvider, Record<string, ModelPrice>> = {
  openai: {
    "gpt-6-luna": {
      inputUsdPerMillionTokens: 0.1,
      cachedInputUsdPerMillionTokens: 0.01,
      cacheWriteInputUsdPerMillionTokens: 0.125,
      outputUsdPerMillionTokens: 0.5,
    },
    "gpt-6.1-sol": {
      inputUsdPerMillionTokens: 2,
      cachedInputUsdPerMillionTokens: 0.1,
      cacheWriteInputUsdPerMillionTokens: 2.5,
      outputUsdPerMillionTokens: 10,
    },
  },
};

export function findModelPrice(provider: ModelProvider, model: string): ModelPrice | undefined {
  return MODEL_PRICES[provider][model];
}
