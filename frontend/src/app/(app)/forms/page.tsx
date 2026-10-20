import type { Metadata } from "next";
import { Suspense } from "react";
import { FormPagesForm } from "@/features/forms/components/form-pages-form";
import { RecentForms } from "@/features/forms/components/recent-forms";
import { getRecentForms } from "@/features/forms/data";

export const metadata: Metadata = { title: "Answer a form" };

export default function FormsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Answer a form</h1>
        <p className="text-ink-muted">
          Add screenshots of an application form, with the job post if you have it. You get an answer to copy for
          each question. Shortlist never opens the form&apos;s link.
        </p>
      </div>
      <FormPagesForm />

      <section aria-labelledby="recent-heading" className="flex flex-col gap-2 pt-4">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recent forms
        </h2>
        {/* Read per request, so it streams in behind a boundary (Cache Components). */}
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <Recent />
        </Suspense>
      </section>
    </main>
  );
}

async function Recent() {
  return <RecentForms forms={await getRecentForms()} />;
}
