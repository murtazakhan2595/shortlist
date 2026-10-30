import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OriginalPost } from "@/components/ui/original-post";
import { JobRow } from "@/features/discovery/components/job-row";
import { getJob } from "@/features/discovery/data";
import { FailureNotice } from "@/features/failed-steps/components/failure-notice";
import { DraftAnswers } from "@/features/forms/components/draft-answers";

export const metadata: Metadata = { title: "Job" };

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <Link href="/jobs" className="self-start text-sm text-ink-muted hover:text-ink hover:underline">
        All jobs
      </Link>
      <h1 className="text-2xl font-bold">Job</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Job params={params} />
      </Suspense>
    </main>
  );
}

async function Job({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  const found = await getJob(id);
  if (!found) notFound();
  const { job, description } = found;
  return (
    <>
      <ul className="flex flex-col">
        <JobRow
          job={job}
          failureNotice={job.failure && <FailureNotice failure={job.failure} />}
          answers={job.canDraftAnswers && <DraftAnswers listingId={job.id} form={job.form} />}
        />
      </ul>
      <OriginalPost text={description} screenshotUrls={[]} />
    </>
  );
}
