import "server-only";

// Contract for POST /api/worker, called by a database trigger when a step is queued and by Supabase Cron
// every minute. It runs a few queued steps and returns what happened. See AGENTS.md "Contracts".

export type WorkerRunSummary = {
  stepsRun: number;
  stepsFailed: number;
  queueEmpty: boolean;
};
