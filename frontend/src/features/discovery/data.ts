import "server-only";
import { requireOwner } from "@/server/auth/require-owner";

// Data Access Layer for discovery: the feature's reads, each starting with the owner check.

/** One listing as the jobs page shows it. */
export type JobView = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  /** The Himalayas page: where to apply, and the credit its terms ask for (D7). */
  url: string;
  source: string;
  tags: string[];
  eligibility: string;
  eligibilityReason: string | null;
  topRank: number | null;
  score: number | null;
  reasons: string | null;
  label: "apply" | "skip" | null;
  /** The prepared note (X2), once the writer has finished it. */
  note: { status: string; body: string | null; cvVariant: string | null; blockedReason: string | null } | null;
};

/** The latest daily run and its listings: the top N, the rest that were scored, and those the filter dropped. */
export type JobsList = {
  run: {
    startedAt: string;
    status: string;
    fetched: number;
    kept: number;
    scored: number;
    costUsd: number;
  };
  top: JobView[];
  alsoScored: JobView[];
  dropped: JobView[];
};

/** The latest daily run's list, or null before the first run. */
export async function getJobsList(): Promise<JobsList | null> {
  const { db } = await requireOwner();
  const run = await db
    .from("runs")
    .select("id, started_at, status, listings_fetched, listings_kept, listings_scored")
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
        "id, title, company, location, url, source, tags, eligibility, eligibility_reason, top_rank, label, scores (score, reasons), applications (status, body, blocked_reason, cv_files (variant))",
      )
      .eq("run_id", run.data.id),
    db.from("model_calls").select("cost_usd").eq("run_id", run.data.id),
  ]);
  if (listings.error) throw new Error(`Could not load the run's listings: ${listings.error.message}`);
  if (calls.error) throw new Error(`Could not load the run's cost: ${calls.error.message}`);

  const jobs: JobView[] = listings.data.map((listing) => {
    const [application] = listing.applications;
    return {
      id: listing.id,
      title: listing.title,
      company: listing.company,
      location: listing.location,
      url: listing.url,
      source: listing.source,
      tags: listing.tags,
      eligibility: listing.eligibility,
      eligibilityReason: listing.eligibility_reason,
      topRank: listing.top_rank,
      score: listing.scores?.score ?? null,
      reasons: listing.scores?.reasons ?? null,
      label: listing.label === "apply" || listing.label === "skip" ? listing.label : null,
      note: application
        ? {
            status: application.status,
            body: application.body,
            cvVariant: application.cv_files?.variant ?? null,
            blockedReason: application.blocked_reason,
          }
        : null,
    };
  });

  const byScore = (a: JobView, b: JobView) => (b.score ?? -1) - (a.score ?? -1);
  return {
    run: {
      startedAt: run.data.started_at,
      status: run.data.status,
      fetched: run.data.listings_fetched,
      kept: run.data.listings_kept,
      scored: run.data.listings_scored,
      costUsd: calls.data.reduce((total, call) => total + call.cost_usd, 0),
    },
    top: jobs.filter((job) => job.topRank !== null).sort((a, b) => (a.topRank ?? 0) - (b.topRank ?? 0)),
    alsoScored: jobs.filter((job) => job.topRank === null && job.eligibility !== "excluded").sort(byScore),
    dropped: jobs.filter((job) => job.eligibility === "excluded"),
  };
}
