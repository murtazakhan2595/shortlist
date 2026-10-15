// Sprint 1 exit check (PLAN.md item 1.8): proves a queued step is picked up by the deployed worker.
//
//   pnpm queue-check              through the instant trigger (expect a few seconds)
//   pnpm queue-check --schedule   through the every-minute schedule only (expect up to a minute)
//
// Needs the app deployed and the app_url and internal_api_secret Vault secrets set.

import { enqueueStep, queueLength } from "@/server/queue/queue";
import { QUEUE_CHECK_STEP } from "@/server/queue/queue-check";
import { getAdminClient } from "@/server/supabase/admin";

const POLL_INTERVAL_MS = 2_000;
const GIVE_UP_AFTER_MS = 90_000;

async function main(): Promise<void> {
  const throughSchedule = process.argv.includes("--schedule");
  const startedAt = Date.now();

  const messageId = await enqueueStep(QUEUE_CHECK_STEP, { sentAt: new Date().toISOString() }, { wake: !throughSchedule });
  console.log(`Queued a check step (${throughSchedule ? "waiting for the schedule" : "instant trigger"})...`);

  while (Date.now() - startedAt < GIVE_UP_AFTER_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if ((await queueLength()) > 0) continue;

    const { data: failure } = await getAdminClient().from("failed_steps").select("error").eq("message_id", messageId).maybeSingle();
    if (failure) throw new Error(`The check step failed: ${failure.error}`);

    console.log(`Picked up and completed after ${((Date.now() - startedAt) / 1000).toFixed(1)} s.`);
    return;
  }
  throw new Error(`Not picked up within ${GIVE_UP_AFTER_MS / 1000} s. Is the app deployed, and are the Vault secrets set?`);
}

await main();
