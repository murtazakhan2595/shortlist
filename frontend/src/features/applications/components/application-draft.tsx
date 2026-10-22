import Link from "next/link";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { formatUsd } from "@/lib/format";
import type { ApplicationView } from "../data";

// Gmail's drafts folder. A link to one draft needs its message id in Gmail's own format, which the API does not give.
const GMAIL_DRAFTS_URL = "https://mail.google.com/mail/#drafts";

/** The email the writer prepared, or why it was stopped, and whether it is in Gmail yet. */
export function ApplicationDraft({ application }: { application: ApplicationView }) {
  if (application.status === "preparing") return null;

  const blocked = application.status === "blocked";
  return (
    <section aria-labelledby="draft-heading" className="flex flex-col gap-4 border-t border-rule pt-6">
      <h2 id="draft-heading" className="text-lg font-semibold">
        {blocked ? "The draft was stopped" : "The prepared email"}
      </h2>

      {application.status === "ready" &&
        (application.inGmail ? (
          <p role="status">
            Saved as a draft in Gmail, with the CV attached.{" "}
            <a href={GMAIL_DRAFTS_URL} target="_blank" rel="noreferrer" className="underline">
              Open Gmail drafts
            </a>
          </p>
        ) : (
          <p className="text-ink-muted">
            <AutoRefresh />
            Saving to Gmail… If Gmail is not connected yet, connect it in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        ))}

      {blocked && application.blockedReason && (
        <div className="flex flex-col gap-2">
          <p className="text-ink-muted">
            The last draft did not pass the checks, so it was not used:
          </p>
          <ul className="list-disc pl-5 text-sm">
            {application.blockedReason.split("\n").map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-ink-muted">To</dt>
        <dd className="break-all">{application.recipientEmail}</dd>
        <dt className="text-ink-muted">Subject</dt>
        <dd>{application.subject}</dd>
        <dt className="text-ink-muted">CV</dt>
        <dd className="break-all">{application.cvFileName ?? "None chosen"}</dd>
        <dt className="text-ink-muted">Presented as</dt>
        <dd>{application.presentedTitle}</dd>
        <dt className="text-ink-muted">Pattern</dt>
        <dd>{application.emailPattern}</dd>
        <dt className="text-ink-muted">Cost</dt>
        <dd>
          {formatUsd(application.costUsd)}{" "}
          <span className="text-ink-muted">
            ({application.modelCalls} model {application.modelCalls === 1 ? "call" : "calls"})
          </span>
        </dd>
      </dl>

      {application.body && (
        <pre className="rounded-md border border-rule bg-field p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {application.body}
        </pre>
      )}
    </section>
  );
}
