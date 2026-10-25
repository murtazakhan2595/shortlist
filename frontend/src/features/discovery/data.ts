import "server-only";
import { NIGHTLY_SOURCES } from "@/lib/source-names";
import { requireOwner } from "@/server/auth/require-owner";
import { findOpenFailures, type OpenFailure } from "@/server/queue/failed-steps";

// Data Access Layer for discovery: the feature's reads, each starting with the owner check.

/** One listing as the jobs page shows it. */
export type JobView = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  /** Where the job came from: "himalayas" or "hackernews". */
  source: string;
  /** The job's page on its source: where to apply or read the post, and the credit its terms ask for (D7). */
  url: string;
  tags: string[];
  eligibility: string;
  eligibilityReason: string | null;
  topRank: number | null;
  score: number | null;
  reasons: string | null;
  label: "apply" | "skip" | null;
  /** The email written when the post gave an address (7.4), which goes to the owner's Gmail drafts. */
  email: { status: string; to: string; body: string | null; inGmail: boolean; blockedReason: string | null } | null;
  /** Scoring this job, or starting or writing its email, failed every attempt (5.6). */
  failure: OpenFailure | null;
};

/** One run's list is a night's work: one taking longer than this has stopped somewhere. */
const RUN_FINISHES_WITHIN_HOURS = 6;
/** The schedule starts a run every 24 hours; a little longer allows for a late start. */
const RUN_STARTS_EVERY_HOURS = 26;

/** One source's jobs from a night: its top N (the daily target), then the rest it kept, by score. */
export type SourceJobs = { source: string; name: string; top: JobView[]; more: JobView[] };

/**
 * The latest daily run and its listings, by source (owner, 25 October 2026). Listings the filter dropped are
 * kept in the database, so a job is not saved twice and the filter can be checked, but are not shown.
 */
export type JobsListView = {
  run: {
    startedAt: string;
    status: string;
    fetched: number;
    kept: number;
    costUsd: number;
    /** Why the owner should look: the run did not finish, or no run started on time. Null when all is well (5.6). */
    warning: string | null;
  };
  /** Steps of the run itself (fetching, choosing the list) that failed every attempt. A job's own are on the job. */
  failures: OpenFailure[];
  /** Every nightly source, in the order the night reads them, even one with no new jobs. */
  sources: SourceJobs[];
};

/** The latest daily run's list, or null before the first run. */
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

  const [listings, calls] = await Promise.all([
    db
      .from("listings")
      .select(
        "id, title, company, location, source, url, tags, eligibility, eligibility_reason, top_rank, label, scores (score, reasons), applications (id, route, status, body, blocked_reason, recipient_email, gmail_draft_id)",
      )
      .eq("run_id", run.data.id)
      .neq("eligibility", "excluded"),
    db.from("model_calls").select("cost_usd").eq("run_id", run.data.id),
  ]);
  if (listings.error) throw new Error(`Could not load the run's listings: ${listings.error.message}`);
  if (calls.error) throw new Error(`Could not load the run's cost: ${calls.error.message}`);

  // Failures name the run (fetching, choosing the list), a listing (scoring, starting its email) or its
  // email's application (writing it).
  const runId = run.data.id;
  const failures = await findOpenFailures(db, [
    runId,
    ...listings.data.map((listing) => listing.id),
    ...listings.data.flatMap((listing) => listing.applications.map((application) => application.id)),
  ]);

  const jobs: JobView[] = listings.data.map((listing) => {
    // Notes written before 25 October 2026 are not shown: only emails are prepared now.
    const email = listing.applications.find((application) => application.route === "email" && application.recipient_email);
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
    // A listing dropped after ranking, because the owner blocked its company, keeps its rank (check E2) but
    // leaves the list: it is excluded, so it was not loaded.
    sources: NIGHTLY_SOURCES.map(({ id, name }) => {
      const fromSource = jobs.filter((job) => job.source === id);
      return {
        source: id,
        name,
        top: fromSource.filter((job) => job.topRank !== null).sort((a, b) => (a.topRank ?? 0) - (b.topRank ?? 0)),
        more: fromSource.filter((job) => job.topRank === null).sort(byScore),
      };
    }),
  };
}

/** Why the latest daily run needs the owner's attention, or null (PLAN.md item 5.6). */
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

/** Why the latest daily run needs the owner's attention, or null, also before the first run (5.6). */
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
