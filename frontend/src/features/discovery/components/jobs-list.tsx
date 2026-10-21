import { AutoRefresh } from "@/components/ui/auto-refresh";
import { formatUsd } from "@/lib/format";
import type { JobsList as JobsListData } from "../data";
import { JobRow } from "./job-row";

const RUN_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Karachi" });

/** The night's list: the top jobs to apply to, then the rest that were scored, then what the filter dropped. */
export function JobsList({ list }: { list: JobsListData | null }) {
  if (!list) {
    return (
      <p className="max-w-prose text-ink-muted">
        No list yet. Every night at 02:00, Shortlist finds new jobs on Himalayas, ranks them against your profile and
        writes a note for the best ones. They appear here.
      </p>
    );
  }

  const { run, top, alsoScored, dropped } = list;
  const running = run.status === "running";
  return (
    <div className="flex flex-col gap-8">
      <p className="text-ink-muted">
        {running && <AutoRefresh />}
        {running ? "Still working on the list from " : "Found on "}
        {RUN_DATE.format(new Date(run.startedAt))}: {run.fetched} new {run.fetched === 1 ? "job" : "jobs"}, {run.kept} kept
        after the filter, {top.length} on your list. Cost {formatUsd(run.costUsd)}.
      </p>

      {top.length > 0 ? (
        <ol className="flex flex-col border-b border-rule">
          {top.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ol>
      ) : (
        !running && <p className="text-ink-muted">No job fitted well enough to make the list this time.</p>
      )}

      {alsoScored.length > 0 && (
        <details>
          <summary className="cursor-pointer text-lg font-semibold">Also scored ({alsoScored.length})</summary>
          <p className="pt-2 text-sm text-ink-muted">
            Below the list: a lower score, or more than your daily target. Mark any you would apply to anyway.
          </p>
          <ul className="flex flex-col pt-2">
            {alsoScored.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        </details>
      )}

      {dropped.length > 0 && (
        <details>
          <summary className="cursor-pointer text-lg font-semibold">Dropped by the filter ({dropped.length})</summary>
          <p className="pt-2 text-sm text-ink-muted">Never scored. If one should not have been dropped, the filter needs a fix.</p>
          <ul className="flex flex-col pt-2">
            {dropped.map((job) => (
              <li key={job.id} className="flex flex-col gap-1 border-t border-rule py-3 text-sm">
                <a href={job.url} target="_blank" rel="noreferrer" className="font-medium underline">
                  {job.title}, {job.company}
                </a>
                <span className="text-ink-muted">{job.eligibilityReason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-sm text-ink-muted">
        Jobs from{" "}
        <a href="https://himalayas.app" target="_blank" rel="noreferrer" className="underline">
          Himalayas
        </a>
        . Apply through each job&apos;s own link.
      </p>
    </div>
  );
}
