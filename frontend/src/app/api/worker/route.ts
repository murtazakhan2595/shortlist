import { describeError } from "@/lib/errors";
import { fail, ok } from "@/lib/result";
import { isInternalCaller } from "@/server/auth/internal-caller";
import { wakeWorker } from "@/server/queue/queue";
import { runNextStep } from "@/server/queue/run-next-step";
import { STEP_HANDLERS } from "./step-handlers";

// POST /api/worker: runs one queued step (AGENTS.md, Contracts).
// Called by Supabase when a step is added, and by Supabase Cron every minute.
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
