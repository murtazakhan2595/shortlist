import "server-only";
import { getAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";

// The queue is Supabase Queues (pgmq); see supabase/migrations/*_step_queue.sql.

/** "steps_test" is used only by tests. */
export type QueueName = "steps" | "steps_test";

export async function enqueueStep(
  step: string,
  payload: Record<string, Json>,
  options: { queue?: QueueName; wake?: boolean } = {},
): Promise<number> {
  const { data, error } = await getAdminClient().rpc("enqueue_step", {
    queue_name: options.queue ?? "steps",
    step,
    payload,
    wake: options.wake ?? true,
  });
  if (error) throw new Error(`Could not queue step ${step}: ${error.message}`);
  return data;
}

/** The database calls the worker route after this returns. */
export async function wakeWorker(): Promise<void> {
  const { error } = await getAdminClient().rpc("wake_worker");
  if (error) throw new Error(`Could not wake the worker: ${error.message}`);
}

/** Includes steps being worked on. */
export async function queueLength(queue: QueueName = "steps"): Promise<number> {
  const { data, error } = await getAdminClient().rpc("queue_length", { queue_name: queue });
  if (error) throw new Error(`Could not read the length of the ${queue} queue: ${error.message}`);
  return data;
}
