import "server-only";
import { requireOwner } from "@/server/auth/require-owner";
import { isGmailConnected } from "@/server/gmail/gmail";

// Data Access Layer for settings: the feature's reads, each starting with the owner check.

/** True once the owner has allowed Gmail drafts (X1). */
export async function getGmailConnected(): Promise<boolean> {
  await requireOwner();
  return isGmailConnected();
}

/** One month's model spending, in total and per step (B1). Months are "YYYY-MM", in UTC. */
export type MonthlySpend = {
  /** Every month with spending, newest first; the current month is always included. */
  months: string[];
  month: string;
  totalUsd: number;
  calls: number;
  steps: { step: string; calls: number; costUsd: number }[];
};

/** The spending for a month, or for the current month when none, or an unknown one, is asked for. */
export async function getMonthlySpend(requestedMonth: string | undefined): Promise<MonthlySpend> {
  const { db } = await requireOwner();
  const { data, error } = await db.from("monthly_spend").select("month, step, calls, cost_usd");
  if (error) throw new Error(`Could not load monthly spending: ${error.message}`);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const months = [...new Set([currentMonth, ...data.flatMap((row) => (row.month ? [row.month] : []))])].sort().reverse();
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : currentMonth;

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
