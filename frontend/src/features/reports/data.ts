import "server-only";
import { requireOwner } from "@/server/auth/require-owner";
import { currentMonth } from "@/server/spending";

// Data Access Layer for reports (PLAN.md item 5.3; U5, B1): the feature's reads, each starting with the
// owner check. Every figure is summed from rows the app already keeps; nothing is stored for reports.

/** One month's model spending, in total and per step. Months are "YYYY-MM", in UTC. */
export type MonthlySpendView = {
  /** Every month with spending, newest first; the current month is always included. */
  months: string[];
  month: string;
  totalUsd: number;
  calls: number;
  steps: { step: string; calls: number; costUsd: number }[];
};

/** The spending for a month, or for the current month when none, or an unknown one, is asked for. */
export async function getMonthlySpend(requestedMonth: string | undefined): Promise<MonthlySpendView> {
  const { db } = await requireOwner();
  const { data, error } = await db.from("monthly_spend").select("month, step, calls, cost_usd");
  if (error) throw new Error(`Could not load monthly spending: ${error.message}`);

  const thisMonth = currentMonth();
  const months = [...new Set([thisMonth, ...data.flatMap((row) => (row.month ? [row.month] : []))])].sort().reverse();
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : thisMonth;

  const steps = data
    .filter((row) => row.month === month)
    .map((row) => ({ step: row.step ?? "unknown", calls: row.calls ?? 0, costUsd: row.cost_usd ?? 0 }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    months,
    month,
    totalUsd: steps.reduce((total, step) => total + step.costUsd, 0),
    calls: steps.reduce((total, step) => total + step.calls, 0),
    steps,
  };
}

/** One nightly run: what it found, what made the list, and what it cost. */
export type RunCost = {
  id: string;
  startedAt: string;
  status: string;
  fetched: number;
  kept: number;
  scored: number;
  onList: number;
  costUsd: number;
};

/** How many nightly runs the report shows: two weeks. */
const RUNS_SHOWN = 14;

/** The latest nightly runs, newest first, each with its cost (B1). Notes written for a run count towards it. */
export async function getRunCosts(): Promise<RunCost[]> {
  const { db } = await requireOwner();
  const runs = await db
    .from("runs")
    .select("id, started_at, status, listings_fetched, listings_kept, listings_scored")
    .eq("kind", "daily")
    .order("started_at", { ascending: false })
    .limit(RUNS_SHOWN);
  if (runs.error) throw new Error(`Could not load the nightly runs: ${runs.error.message}`);
  const runIds = runs.data.map((run) => run.id);
  if (runIds.length === 0) return [];

  const [calls, listed] = await Promise.all([
    db.from("model_calls").select("run_id, cost_usd").in("run_id", runIds),
    db.from("listings").select("run_id").in("run_id", runIds).not("top_rank", "is", null),
  ]);
  if (calls.error) throw new Error(`Could not load the runs' costs: ${calls.error.message}`);
  if (listed.error) throw new Error(`Could not load the runs' lists: ${listed.error.message}`);

  return runs.data.map((run) => ({
    id: run.id,
    startedAt: run.started_at,
    status: run.status,
    fetched: run.listings_fetched,
    kept: run.listings_kept,
    scored: run.listings_scored,
    onList: listed.data.filter((listing) => listing.run_id === run.id).length,
    costUsd: calls.data.filter((call) => call.run_id === run.id).reduce((total, call) => total + call.cost_usd, 0),
  }));
}

/** How the applications sent from one source, or with one email pattern, did. */
export type ReplyRate = { name: string; sent: number; replied: number; interviews: number };

export type ReplyRates = { bySource: ReplyRate[]; byPattern: ReplyRate[] };

/** One sent application, as the rates count it. */
export type SentApplication = { source: string; pattern: string | null; status: string };

const SOURCE_NAMES: Record<string, string> = { himalayas: "Himalayas" };

/** Reply and interview rates per source and per email pattern, over every application the owner sent (U5). */
export async function getReplyRates(): Promise<ReplyRates> {
  const { db } = await requireOwner();
  // Sent is any application marked sent, replied or interview: a reply means it was sent.
  const { data, error } = await db
    .from("applications")
    .select("route, status, captures (id), listings (source), documents (name)")
    .not("sent_at", "is", null)
    .neq("status", "skipped");
  if (error) throw new Error(`Could not load the sent applications: ${error.message}`);

  return replyRates(
    data.map((row) => ({
      source: row.captures ? "LinkedIn" : row.listings ? (SOURCE_NAMES[row.listings.source] ?? row.listings.source) : "Forms",
      pattern: row.documents?.name ?? null,
      status: row.status,
    })),
  );
}

/** Counts sent, replied and interviews per source and per pattern, most sent first. */
export function replyRates(sent: SentApplication[]): ReplyRates {
  return {
    bySource: countBy(sent, (application) => application.source),
    byPattern: countBy(sent, (application) => application.pattern),
  };
}

function countBy(sent: SentApplication[], nameOf: (application: SentApplication) => string | null): ReplyRate[] {
  const rates = new Map<string, ReplyRate>();
  for (const application of sent) {
    const name = nameOf(application);
    if (!name) continue;
    const rate = rates.get(name) ?? { name, sent: 0, replied: 0, interviews: 0 };
    rate.sent++;
    // An interview came from a reply.
    if (application.status === "replied" || application.status === "interview") rate.replied++;
    if (application.status === "interview") rate.interviews++;
    rates.set(name, rate);
  }
  return [...rates.values()].sort((a, b) => b.sent - a.sent || a.name.localeCompare(b.name));
}
