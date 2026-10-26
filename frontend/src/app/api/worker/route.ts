import { describeError } from "@/lib/errors";
import { fail, ok } from "@/lib/result";
import { isInternalCaller } from "@/server/auth/internal-caller";
import { wakeWorker } from "@/server/queue/queue";
import { runNextStep } from "@/server/queue/run-next-step";
import { STEP_HANDLERS } from "./step-handlers";

// Set here so the step budget does not depend on the host's default.
export const maxDuration = 60;

// Only Supabase calls this (a database trigger and Cron), so it checks the internal secret, not a session.
export async function POST(request: Request): Promise<Response> {
  if (!isInternalCaller(request)) {
    return Response.json(fail("unauthorized", "Missing or wrong internal API secret"), { status: 401 });
  }

  try {
    const summary = await runNextStep(STEP_HANDLERS);
    // While steps are waiting, the next one runs in a new call, so each call stays within the 60-second budget.
    if (!summary.queueEmpty) await wakeWorker();
    return Response.json(ok(summary));
  } catch (error) {
    return Response.json(fail("internal", describeError(error)), { status: 500 });
  }
}
