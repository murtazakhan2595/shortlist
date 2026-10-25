import { randomUUID } from "node:crypto";
import { AIMessage } from "@langchain/core/messages";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { callModel } from "@/server/models/call-model";
import { getAdminClient } from "@/server/supabase/admin";
import { TEST_RUN_STARTED_AT } from "./test-runs";

// callModel against the real database, with the provider replaced by a fake: tests never call a real model.
const invokeModel = vi.hoisted(() => vi.fn());
vi.mock("@/server/models/chat-models", () => ({
  createStructuredModel: () => ({ invoke: invokeModel }),
}));

const ScoreSchema = z.object({ score: z.int().min(0).max(100) });

function modelAnswer(parsed: unknown, usage = { input_tokens: 1_000, output_tokens: 200 }, cachedInputTokens = 0) {
  const raw = new AIMessage({
    content: JSON.stringify(parsed),
    usage_metadata: {
      ...usage,
      total_tokens: usage.input_tokens + usage.output_tokens,
      input_token_details: { cache_read: cachedInputTokens },
    },
  });
  return { raw, parsed };
}

describe("callModel", () => {
  const database = getAdminClient();
  let runId: string;

  // Calls are linked to a test run, so every row this test creates can be found and deleted.
  beforeAll(async () => {
    const { data, error } = await database.from("runs").insert({ kind: "daily", started_at: TEST_RUN_STARTED_AT }).select("id").single();
    if (error) throw error;
    runId = data.id;
  });

  afterAll(async () => {
    await database.from("model_calls").delete().eq("run_id", runId);
    await database.from("runs").delete().eq("id", runId);
  });

  beforeEach(() => {
    invokeModel.mockReset();
  });

  async function recordedCalls() {
    const { data, error } = await database.from("model_calls").select("*").eq("run_id", runId).order("created_at");
    if (error) throw error;
    return data;
  }

  const request = {
    step: "score_listing" as const,
    schema: ScoreSchema,
    messages: [{ role: "user" as const, content: "Score this listing." }],
  };

  test("returns the checked answer and records the call with its cost", async () => {
    invokeModel.mockResolvedValue(modelAnswer({ score: 82 }));

    const result = await callModel({ ...request, link: { runId } });

    expect(result.output).toEqual({ score: 82 });
    const [call] = await recordedCalls();
    expect(call).toMatchObject({
      id: result.modelCallId,
      step: "score_listing",
      provider: "openai",
      model: "gpt-6-luna",
      effort: "medium",
      input_tokens: 1_000,
      output_tokens: 200,
      cost_usd: 0.0002,
      error: null,
    });
  });

  test("records input read from the provider's cache, at the cached price", async () => {
    invokeModel.mockResolvedValue(modelAnswer({ score: 70 }, { input_tokens: 100_000, output_tokens: 0 }, 90_000));

    await callModel({ ...request, link: { runId } });

    // gpt-6-luna: 10,000 uncached at $0.10 per million plus 90,000 cached at $0.01 per million.
    const call = (await recordedCalls()).at(-1);
    expect(call).toMatchObject({ input_tokens: 100_000, cached_input_tokens: 90_000, cost_usd: 0.0019 });
  });

  test("an answer in the wrong shape fails, and its tokens are still recorded and costed", async () => {
    invokeModel.mockResolvedValue(modelAnswer({ score: "high" }));

    await expect(callModel({ ...request, link: { runId } })).rejects.toThrow(z.ZodError);

    const failed = (await recordedCalls()).at(-1);
    expect(failed).toMatchObject({ input_tokens: 1_000, output_tokens: 200, cost_usd: 0.0002 });
    expect(failed?.error).toContain("ZodError");
  });

  test("an evaluation can try another model on the same step", async () => {
    invokeModel.mockResolvedValue(modelAnswer({ score: 40 }));
    const model = { provider: "openai" as const, model: "gpt-6.1-sol", effort: "high" as const };

    await callModel({ ...request, model, link: { runId } });

    const call = (await recordedCalls()).at(-1);
    expect(call).toMatchObject({ model: "gpt-6.1-sol", effort: "high", cost_usd: 0.004 });
  });

  test("a provider error or timeout fails, and is recorded", async () => {
    invokeModel.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    await expect(callModel({ ...request, link: { runId } })).rejects.toThrow("timed out");

    const failed = (await recordedCalls()).at(-1);
    expect(failed).toMatchObject({ input_tokens: 0, output_tokens: 0, cost_usd: 0 });
    expect(failed?.error).toContain("TimeoutError");
  });
  test("when the call cannot be recorded, a successful answer is not used, and a failed call keeps its own error", async () => {
    // Linked to a run that does not exist, so the row is refused.
    const unrecordable = { ...request, link: { runId: randomUUID() } };
    vi.spyOn(console, "error").mockImplementation(() => {});

    invokeModel.mockResolvedValue(modelAnswer({ score: 82 }));
    await expect(callModel(unrecordable)).rejects.toThrow(/Could not record the model call/);

    invokeModel.mockRejectedValue(new Error("The provider is down"));
    await expect(callModel(unrecordable)).rejects.toThrow("The provider is down");
    expect(console.error).toHaveBeenCalledWith("A failed model call could not be recorded:", expect.any(String));
  });
});
