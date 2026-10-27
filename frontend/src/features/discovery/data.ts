import "server-only";
import { cvName } from "@/lib/cv-variants";
import { NIGHTLY_SOURCES } from "@/lib/source-names";
import { requireOwner } from "@/server/auth/require-owner";
import { GREENHOUSE_SOURCE } from "@/server/greenhouse";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";

export type JobView = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string;
  /** Also the credit the source's terms ask for. */
  url: string;
  tags: string[];
  eligibility: string;
  eligibilityReason: string | null;
  topRank: number | null;
  score: number | null;
  reasons: string | null;
  label: "apply" | "skip" | null;
  email: { status: string; to: string; body: string | null; inGmail: boolean; blockedReason: string | null } | null;
  /** The CV attached to the email, or else the one the scoring picked, by name ("AI engineer"). */
  cv: string | null;
  /** Greenhouse publishes a job's questions, so answers can be drafted for it. */
  canDraftAnswers: boolean;
  form: { id: string; status: string } | null;
  failure: OpenFailure | null;
};

// A run taking longer than this has stopped somewhere.
const RUN_FINISHES_WITHIN_HOURS = 6;
// Runs start every 24 hours; the extra allows for a late start.
const RUN_STARTS_EVERY_HOURS = 26;

// From each source's latest run that kept any jobs, so a source with nothing new (Hacker News between
// monthly threads) keeps its last list. earlierRun is set when that is not the latest run.
export type SourceJobs = { source: string; name: string; top: JobView[]; more: JobView[]; earlierRun: string | null };

export type JobsListView = {
  run: {
    startedAt: string;
    status: string;
    fetched: number;
    kept: number;
    costUsd: number;
    warning: string | null;
  };
  /** The run's own failed steps; a job's failures are on the job. */
  failures: OpenFailure[];
  /** Every nightly source, even one with no new jobs. */
  sources: SourceJobs[];
};

export async function getJobsList(): Promise<JobsListView | null> {
  const { db } = await requireOwner();
  const run = await db
    .from("runs")
    .select("id, started_at, status, listings_fetched, listings_kept")
    .eq("kind", "daily")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (run.error) throw new Error(`Could not load the latest daily run: ${run.error.message}`);
  if (!run.data) return null;

  const sourceRuns = await Promise.all(
    NIGHTLY_SOURCES.map(async ({ id }) => {
      const latest = await db
        .from("listings")
        .select("run_id, runs!inner (started_at, kind)")
        .eq("source", id)
        .eq("runs.kind", "daily")
        .neq("eligibility", "excluded")
        .order("runs(started_at)", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest.error) throw new Error(`Could not find the latest jobs from ${id}: ${latest.error.message}`);
      return latest.data?.run_id ? { source: id, runId: latest.data.run_id, startedAt: latest.data.runs.started_at } : null;
    }),
  );
  const shownRuns = sourceRuns.filter((sourceRun) => sourceRun !== null);

  const [loaded, calls] = await Promise.all([
    db
      .from("listings")
      .select(
        "id, title, company, location, source, url, tags, eligibility, eligibility_reason, top_rank, label, run_id, scores (score, reasons, cv_variant), applications (id, route, status, body, blocked_reason, recipient_email, gmail_draft_id, cv_files (variant))",
      )
      .in("run_id", shownRuns.length > 0 ? shownRuns.map((sourceRun) => sourceRun.runId) : [run.data.id])
      .neq("eligibility", "excluded"),
    db.from("model_calls").select("cost_usd").eq("run_id", run.data.id),
  ]);
  if (loaded.error) throw new Error(`Could not load the listings: ${loaded.error.message}`);
  // Two sources may share a run, so each keeps only its own listings from its own run.
  const listings = loaded.data.filter((listing) =>
    shownRuns.some((sourceRun) => sourceRun.source === listing.source && sourceRun.runId === listing.run_id),
  );
  if (calls.error) throw new Error(`Could not load the run's cost: ${calls.error.message}`);

  const runId = run.data.id;
  const failures = await findOpenFailures(db, [
    runId,
    ...listings.map((listing) => listing.id),
    ...listings.flatMap((listing) => listing.applications.map((application) => application.id)),
  ]);

  const jobs: JobView[] = listings.map((listing) => {
    // Older notes are not shown: only emails are prepared now.
    const email = listing.applications.find((application) => application.route === "email" && application.recipient_email);
    const form = listing.applications.find((application) => application.route === "form");
    const ownIds = [listing.id, ...listing.applications.map((own) => own.id)];
    return {
      id: listing.id,
      title: listing.title,
      company: listing.company,
      location: listing.location,
      source: listing.source,
      url: listing.url,
      tags: listing.tags,
      eligibility: listing.eligibility,
      eligibilityReason: listing.eligibility_reason,
      topRank: listing.top_rank,
      score: listing.scores?.score ?? null,
      reasons: listing.scores?.reasons ?? null,
      label: listing.label === "apply" || listing.label === "skip" ? listing.label : null,
      email:
        email?.recipient_email
          ? {
              status: email.status,
              to: email.recipient_email,
              body: email.body,
              inGmail: email.gmail_draft_id !== null,
              blockedReason: email.blocked_reason,
            }
          : null,
      cv: cvOf(email?.cv_files?.variant ?? listing.scores?.cv_variant),
      canDraftAnswers: listing.source === GREENHOUSE_SOURCE,
      form: form ? { id: form.id, status: form.status } : null,
      failure: failures.find((failure) => failure.targetIds.some((id) => ownIds.includes(id))) ?? null,
    };
  });

  const byScore = (a: JobView, b: JobView) => (b.score ?? -1) - (a.score ?? -1);
  return {
    run: {
      startedAt: run.data.started_at,
      status: run.data.status,
      fetched: run.data.listings_fetched,
      kept: run.data.listings_kept,
      costUsd: calls.data.reduce((total, call) => total + call.cost_usd, 0),
      warning: runWarning(run.data, new Date()),
    },
    failures: failures.filter((failure) => failure.targetIds.includes(runId)),
    // A listing whose company was blocked after ranking keeps its rank but is excluded, so it was not loaded.
    sources: NIGHTLY_SOURCES.map(({ id, name }) => {
      const fromSource = jobs.filter((job) => job.source === id);
      const sourceRun = shownRuns.find((shown) => shown.source === id);
      return {
        source: id,
        name,
        earlierRun: sourceRun && sourceRun.runId !== runId ? sourceRun.startedAt : null,
        top: fromSource.filter((job) => job.topRank !== null).sort((a, b) => (a.topRank ?? 0) - (b.topRank ?? 0)),
        more: fromSource.filter((job) => job.topRank === null).sort(byScore),
      };
    }),
  };
}

export function runWarning(run: { status: string; started_at: string }, now: Date): string | null {
  const hoursSinceStart = (now.getTime() - new Date(run.started_at).getTime()) / 3_600_000;
  if (run.status === "running" && hoursSinceStart > RUN_FINISHES_WITHIN_HOURS) {
    return `The nightly run has not finished after ${RUN_FINISHES_WITHIN_HOURS} hours. Try its failed steps again.`;
  }
  // A run also fails when the owner dismisses its failed step, so this does not say to try one again.
  if (run.status === "failed") return "The nightly run stopped before it finished. The next one starts tonight.";
  if (hoursSinceStart > RUN_STARTS_EVERY_HOURS) {
    return "No nightly run has started for over a day. The schedule in Supabase may have stopped.";
  }
  return null;
}

export async function getLatestRunWarning(): Promise<string | null> {
  const { db } = await requireOwner();
  const { data, error } = await db
    .from("runs")
    .select("status, started_at")
    .eq("kind", "daily")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the latest daily run: ${error.message}`);
  return data ? runWarning(data, new Date()) : null;
}

function cvOf(variant: string | null | undefined): string | null {
  return variant ? cvName(variant) : null;
}
