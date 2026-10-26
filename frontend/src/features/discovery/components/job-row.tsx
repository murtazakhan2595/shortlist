"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { sourceName } from "@/lib/source-names";
import { blockCompany, labelListing } from "../actions";
import type { JobView } from "../data";

type Label = NonNullable<JobView["label"]>;

const MARK_BUTTON =
  "h-10 cursor-pointer rounded-md px-4 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-wait";
const MARK_STYLES: Record<Label, { on: string; off: string }> = {
  apply: { on: "bg-ink text-paper", off: "border border-ink text-ink hover:bg-field" },
  skip: { on: "border border-ink-muted bg-field text-ink-muted", off: "border border-rule text-ink-muted hover:border-ink hover:text-ink" },
};

/** The mark shows at once and is saved in the background. failureNotice replaces the email when a step failed. */
export function JobRow({ job, failureNotice, answers }: { job: JobView; failureNotice?: ReactNode; answers?: ReactNode }) {
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

        {job.failure ? failureNotice : job.email && <Email email={job.email} />}

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
            Open the job on {sourceName(job.source)}
          </a>
        </div>
        {answers}
        <BlockCompany listingId={job.id} company={job.company} />
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

function BlockCompany({ listingId, company }: { listingId: string; company: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function block() {
    startTransition(async () => {
      const result = await blockCompany({ listingId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm text-ink-muted underline hover:text-ink">
        Block {company}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Hide every job from {company}, tonight and from now on? You can undo it in Settings.</p>
      <div className="flex gap-2">
        <button type="button" onClick={block} disabled={isPending} className={`${MARK_BUTTON} bg-ink text-paper`}>
          {isPending ? "Blocking…" : `Block ${company}`}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className={`${MARK_BUTTON} border border-rule text-ink-muted hover:text-ink`}>
          Keep
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const TAG_NAMES: Record<string, string> = { remote: "remote", contractor: "contract", visa: "sponsors visas" };

function tagNames(tags: string[]): string[] {
  return tags.map((tag) => TAG_NAMES[tag] ?? tag);
}

function Email({ email }: { email: NonNullable<JobView["email"]> }) {
  if (email.status === "preparing") return <p className="text-sm text-ink-muted">Writing the email to {email.to}…</p>;

  if (email.status === "blocked") {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-semibold">No email.</span> Write to {email.to} yourself. Why it stopped:
        </p>
        {email.blockedReason && (
          <ul className="list-disc pl-5 text-ink-muted">
            {email.blockedReason.split("\n").map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-semibold">Email to {email.to}:</span>{" "}
        {email.inGmail ? "in your Gmail drafts, with your CV attached." : "being saved to your Gmail drafts."}
      </p>
      <div className="flex items-start gap-3 rounded-md border border-rule bg-field p-3">
        <p className="min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words">{email.body}</p>
        {email.body && <CopyButton text={email.body} />}
      </div>
    </div>
  );
}
