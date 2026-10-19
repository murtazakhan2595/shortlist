import type { ApplicationView } from "../data";

/** The email the writer prepared, or why it was stopped. Gmail drafts come with item 2.3. */
export function ApplicationDraft({ application }: { application: ApplicationView }) {
  if (application.status === "preparing") return null;

  const blocked = application.status === "blocked";
  return (
    <section aria-labelledby="draft-heading" className="flex flex-col gap-4 border-t border-rule pt-6">
      <h2 id="draft-heading" className="text-lg font-semibold">
        {blocked ? "The draft was stopped" : "The prepared email"}
      </h2>

      {blocked && application.blockedReason && (
        <div className="flex flex-col gap-2">
          <p className="text-ink-muted">
            It still made claims the profile does not support after three tries, so it was not used:
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
      </dl>

      {application.body && (
        <pre className="rounded-md border border-rule bg-field p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {application.body}
        </pre>
      )}
    </section>
  );
}
