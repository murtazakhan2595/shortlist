import "server-only";
import { z } from "zod";
import type { Json } from "@/server/supabase/database.types";

// A step that does no work, used by `pnpm queue-check` to prove the worker picks steps up.

export const QUEUE_CHECK_STEP = "queue_check";

export const QueueCheckPayloadSchema = z.object({ sentAt: z.iso.datetime() });

export async function runQueueCheck(payload: Json): Promise<void> {
  const { sentAt } = QueueCheckPayloadSchema.parse(payload);
  const waitedSeconds = (Date.now() - Date.parse(sentAt)) / 1000;
  console.info(`Queue check picked up ${waitedSeconds.toFixed(1)} s after it was queued`);
}
