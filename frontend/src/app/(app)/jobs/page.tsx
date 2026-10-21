import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsList } from "@/features/discovery/components/jobs-list";
import { getJobsList } from "@/features/discovery/data";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Jobs</h1>
      {/* Read per request, so it streams in behind a boundary (Cache Components). */}
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  return <JobsList list={await getJobsList()} />;
}
