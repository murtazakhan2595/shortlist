import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import type { CaptureView } from "../data";

/**
 * One captured post: what was read from it, and what happens next. failureNotice is shown in place of the
 * progress while the post is read or its email written, if a step doing that failed every attempt.
 */
export function CaptureDetails({ capture, failureNotice }: { capture: CaptureView; failureNotice?: ReactNode }) {
  const stuck = failureNotice && (capture.status === "received" || capture.status === "processing");
  return (
    <div className="flex flex-col gap-8">
      <section aria-live="polite" className="flex flex-col gap-4">
        {stuck ? failureNotice : <NextStep capture={capture} />}
      </section>

      {capture.status !== "received" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-rule pt-6">
          <Detail term="Role" value={capture.role} />
          <Detail term="Company" value={capture.company} />
          <Detail term="Posted by" value={capture.posterName} />
          {capture.postUrl && <Detail term="Post link" value={capture.postUrl} />}
        </dl>
      )}
    </div>
  );
}

function NextStep({ capture }: { capture: CaptureView }) {
  switch (capture.status) {
    case "received":
      return (
        <>
          <AutoRefresh />
          <p className="text-lg font-semibold">Reading the post…</p>
          <p className="text-ink-muted">This usually takes a few seconds. The page updates on its own.</p>
        </>
      );
    case "processing":
      return (
        <>
          <AutoRefresh />
          <p className="text-lg font-semibold">Writing the application…</p>
          <p className="text-ink-muted">
            To <span className="font-medium text-ink">{capture.contactEmail}</span>. Writing and checking take
            up to a minute.
          </p>
        </>
      );
    case "done":
      // The application below says whether it is ready or blocked.
      return <p className="text-lg font-semibold">Post read</p>;
    case "duplicate":
      return (
        <>
          <p className="text-lg font-semibold">You already have an application for this job</p>
          <p className="text-ink-muted">The same role at the same address was captured before, so no second one was written.</p>
        </>
      );
    case "needs_form":
      return (
        <>
          <p className="text-lg font-semibold">This post asks you to apply through a link</p>
          <p className="break-all">
            <a href={capture.formUrl ?? undefined} target="_blank" rel="noreferrer noopener" className="underline">
              {capture.formUrl}
            </a>
          </p>
          <p className="text-ink-muted">
            Shortlist does not open it. If it is a form, open it yourself, take screenshots of its pages and of this
            post, and{" "}
            <Link href="/forms" className="underline">
              add them on the forms page
            </Link>{" "}
            for answers to copy.
          </p>
        </>
      );
    case "no_contact":
      return (
        <>
          <p className="text-lg font-semibold">No email or application link found</p>
          <p className="text-ink-muted">
            The post does not say how to apply. If it does and was missed, capture it again as pasted text.
          </p>
        </>
      );
    default:
      return <p className="text-lg font-semibold">Status: {capture.status}</p>;
  }
}

function Detail({ term, value }: { term: string; value: string | null }) {
  return (
    <>
      <dt className="text-ink-muted">{term}</dt>
      <dd className="break-words">{value ?? <span className="text-ink-muted">Not stated</span>}</dd>
    </>
  );
}
