import "server-only";

// Contract for POST /api/worker, called by a database trigger on enqueue and by Supabase Cron every minute.

export type WorkerRunSummary = {
  stepsRun: number;
  stepsFailed: number;
  queueEmpty: boolean;
};
