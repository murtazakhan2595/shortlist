"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { labelListing } from "../actions";
import type { JobView } from "../data";

type Label = NonNullable<JobView["label"]>;

const MARK_BUTTON =
  "h-10 cursor-pointer rounded-md px-4 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-wait";
const MARK_STYLES: Record<Label, { on: string; off: string }> = {
  apply: { on: "bg-ink text-paper", off: "border border-ink text-ink hover:bg-field" },
  skip: { on: "border border-ink-muted bg-field text-ink-muted", off: "border border-rule text-ink-muted hover:border-ink hover:text-ink" },
};

/**
 * One job on the list, marked by hand as on a printed shortlist: apply puts a tick by it, skip strikes it
 * through (U7). The mark shows at once and is saved in the background. failureNotice shows a step for this
 * job that failed every attempt (job.failure), in place of its note.
 */
export function JobRow({ job, failureNotice }: { job: JobView; failureNotice?: ReactNode }) {
  const router = useRouter();
  const [label, setLabel] = useState(job.label);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function mark(next: Label) {
    const previous = label;
    setLabel(next);
    setError(undefined);
    startTransition(async () => {
      const result = await labelListing({ listingId: job.id, label: next });
      if (!result.ok) {
        setLabel(previous);
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="grid grid-cols-[2rem_1fr_auto] gap-x-3 border-t border-rule py-5">
      <span className="pt-0.5 text-sm font-semibold tabular-nums text-ink-muted" aria-hidden>
        {label === "apply" ? <span className="text-lg leading-none text-ink">✓</span> : job.topRank && `${job.topRank}.`}
      </span>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className={`font-semibold ${label === "skip" ? "text-ink-muted line-through" : ""}`}>{job.title}</h2>
          <p className="text-sm text-ink-muted">{[job.company, job.location, ...tagNames(job.tags)].filter(Boolean).join(", ")}</p>
          {job.eligibility === "unclear" && job.eligibilityReason && (
            <p className="text-sm">
              <span className="font-semibold">Check first:</span> {job.eligibilityReason}.
            </p>
          )}
        </div>

        {job.reasons && (
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-muted hover:text-ink">Why it scored {job.score}</summary>
            <p className="pt-2 whitespace-pre-wrap">{job.reasons}</p>
          </details>
        )}

        {job.failure ? failureNotice : job.note && <Note note={job.note} />}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex gap-2" role="group" aria-label={`Mark ${job.title}`}>
            {(["apply", "skip"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={label === option}
                disabled={isPending}
                onClick={() => mark(option)}
                className={`${MARK_BUTTON} ${label === option ? MARK_STYLES[option].on : MARK_STYLES[option].off}`}
              >
                {option === "apply" ? "Apply" : "Skip"}
              </button>
            ))}
          </div>
          <a href={job.url} target="_blank" rel="noreferrer" className="text-sm underline">
            Open the job on Himalayas
          </a>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {job.score !== null && (
        <p className="flex flex-col items-end">
          <span className="text-3xl leading-none font-bold tabular-nums">{job.score}</span>
          <span className="pt-1 text-xs text-ink-muted">score</span>
        </p>
      )}
    </li>
  );
}

const TAG_NAMES: Record<string, string> = { remote: "remote", contractor: "contract", visa: "sponsors visas" };

function tagNames(tags: string[]): string[] {
  return tags.map((tag) => TAG_NAMES[tag] ?? tag);
}

function Note({ note }: { note: NonNullable<JobView["note"]> }) {
  if (note.status === "preparing") return <p className="text-sm text-ink-muted">Writing the note…</p>;

  if (note.status === "blocked") {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-semibold">No note.</span> Write this one yourself. Why it stopped:
        </p>
        {note.blockedReason && (
          <ul className="list-disc pl-5 text-ink-muted">
            {note.blockedReason.split("\n").map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3 rounded-md border border-rule bg-field p-3">
        <p className="min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words">{note.body}</p>
        {note.body && <CopyButton text={note.body} />}
      </div>
      {note.cvVariant && <p className="text-sm text-ink-muted">Send your {note.cvVariant.replaceAll("_", " ")} CV.</p>}
    </div>
  );
}
