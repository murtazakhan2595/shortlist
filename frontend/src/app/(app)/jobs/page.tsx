import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsList } from "@/features/discovery/components/jobs-list";
import { getJobsList } from "@/features/discovery/data";
import { FailureNotice } from "@/features/failed-steps/components/failure-notice";
import { DraftAnswers } from "@/features/forms/components/draft-answers";
import { CapReached } from "@/features/settings/components/cap-reached";
import { getSpendingCap } from "@/features/settings/data";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Jobs</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const [list, cap] = await Promise.all([getJobsList(), getSpendingCap()]);
  return (
    <>
      <CapReached cap={cap} />
      <JobsList
        list={list}
        renderFailure={(failure) => <FailureNotice key={failure.id} failure={failure} />}
        renderAnswers={(job) => job.canDraftAnswers && <DraftAnswers listingId={job.id} form={job.form} />}
      />
    </>
  );
}
