import type { ReactNode } from "react";
import type { OpenFailure } from "@/server/queue/failed-steps";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { formatUsd } from "@/lib/format";
import { NIGHTLY_SOURCES } from "@/lib/source-names";
import type { JobsListView, SourceJobs } from "../data";
import { JobRow } from "./job-row";
import { SourceTabs } from "./source-tabs";

const RUN_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Karachi" });

type RenderFailure = (failure: OpenFailure) => ReactNode;

export function JobsList({ list, renderFailure }: { list: JobsListView | null; renderFailure: RenderFailure }) {
  if (!list) {
    return (
      <p className="max-w-prose text-ink-muted">
        No list yet. Every night at 02:00, Shortlist finds new jobs on {NIGHTLY_SOURCES.map((source) => source.name).join(" and ")},
        ranks them against your profile and writes an email for the best ones that give an address. They appear here.
      </p>
    );
  }

  const { run } = list;
  const running = run.status === "running";
  // A run that failed for good will not progress, so the page stops refreshing itself.
  const stuck = list.failures.length > 0 || run.warning !== null;
  const onList = list.sources.reduce((total, source) => total + source.top.length, 0);
  return (
    <div className="flex flex-col gap-8">
      {run.warning && (
        <p role="alert" className="font-semibold text-danger">
          {run.warning}
        </p>
      )}
      {list.failures.length > 0 && <div className="flex flex-col gap-3">{list.failures.map(renderFailure)}</div>}

      <p className="text-ink-muted">
        {running && !stuck && <AutoRefresh />}
        {running ? "Still working on the list from " : "Found on "}
        {RUN_DATE.format(new Date(run.startedAt))}: {run.fetched} {run.fetched === 1 ? "job" : "jobs"} read, {run.kept} new
        ones kept after the filter, {onList} on your lists. Cost {formatUsd(run.costUsd)}.
      </p>

      <SourceTabs
        tabs={list.sources.map((source) => ({
          source: source.source,
          label: `${source.name} (${source.top.length + source.more.length})`,
          content: <SourceList jobs={source} running={running} renderFailure={renderFailure} />,
        }))}
      />

      <p className="text-sm text-ink-muted">
        Jobs from{" "}
        {NIGHTLY_SOURCES.map((source, index) => (
          <span key={source.site}>
            {index > 0 && " and "}
            <a href={source.site} target="_blank" rel="noreferrer" className="underline">
              {source.name}
            </a>
          </span>
        ))}
        . Apply through each job&apos;s own link.
      </p>
    </div>
  );
}

function SourceList({ jobs, running, renderFailure }: { jobs: SourceJobs; running: boolean; renderFailure: RenderFailure }) {
  if (jobs.top.length === 0 && jobs.more.length === 0) {
    return !running && <p className="text-ink-muted">No new jobs from {jobs.name} this time.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {jobs.earlierRun && (
        <p className="text-ink-muted">
          No new jobs from {jobs.name} {running ? "yet" : "this time"}. These are from {RUN_DATE.format(new Date(jobs.earlierRun))}.
        </p>
      )}
      {jobs.top.length > 0 ? (
        <ol className="flex flex-col border-b border-rule">
          {jobs.top.map((job) => (
            <JobRow key={job.id} job={job} failureNotice={job.failure && renderFailure(job.failure)} />
          ))}
        </ol>
      ) : (
        !running && <p className="text-ink-muted">No job from {jobs.name} fitted well enough to make the top this time.</p>
      )}

      {jobs.more.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">More from {jobs.name} ({jobs.more.length})</h2>
          <p className="text-sm text-ink-muted">By score, below the top. Mark any you would apply to anyway.</p>
          <ul className="flex flex-col">
            {jobs.more.map((job) => (
              <JobRow key={job.id} job={job} failureNotice={job.failure && renderFailure(job.failure)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
