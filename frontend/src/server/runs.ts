import "server-only";
import { getAdminClient } from "@/server/supabase/admin";

// A run is one daily run, one capture or one evaluation; its model calls link to it (B1).

/** Marks a run as finished. Safe to repeat: finishing a finished run changes nothing that matters. */
export async function finishRun(runId: string, status: "succeeded" | "failed" = "succeeded"): Promise<void> {
  const { error } = await getAdminClient()
    .from("runs")
    .update({ status, finished_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "running");
  if (error) throw new Error(`Could not finish run ${runId}: ${error.message}`);
}
