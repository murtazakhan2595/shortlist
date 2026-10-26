// One real model call, then the cost row it recorded. Costs about $0.0001 on gpt-6-luna.

import { z } from "zod";
import { callModel } from "@/server/models/call-model";
import { getAdminClient } from "@/server/supabase/admin";

const ReadySchema = z.object({ ready: z.boolean().describe("true if you can read this message") });

async function main(): Promise<void> {
  const { output, modelCallId } = await callModel({
    step: "score_listing",
    schema: ReadySchema,
    messages: [{ role: "user", content: "This is a connection check. Are you ready?" }],
  });
  console.log("Model answered:", output);

  const { data, error } = await getAdminClient()
    .from("model_calls")
    .select("step, provider, model, effort, input_tokens, output_tokens, cost_usd, duration_ms, error")
    .eq("id", modelCallId)
    .single();
  if (error) throw error;
  console.log("Recorded in model_calls:", data);
}

await main();
