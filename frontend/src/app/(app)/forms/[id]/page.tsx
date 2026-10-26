import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FailureNotice } from "@/features/failed-steps/components/failure-notice";
import { FormDetails } from "@/features/forms/components/form-details";
import { FormPagesForm } from "@/features/forms/components/form-pages-form";
import { getForm } from "@/features/forms/data";

export const metadata: Metadata = { title: "Form answers" };

export default function FormPage({ params }: PageProps<"/forms/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <Link href="/forms" className="self-start text-sm text-ink-muted hover:text-ink hover:underline">
        All forms
      </Link>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Form params={params} />
      </Suspense>
    </main>
  );
}

async function Form({ params }: { params: PageProps<"/forms/[id]">["params"] }) {
  const { id } = await params;
  const form = await getForm(id);
  if (!form) notFound();
  return (
    <>
      <FormDetails form={form} failureNotice={form.failure && <FailureNotice failure={form.failure} />} />
      {/* Pages added while earlier ones are worked on would start a second chain of steps (actions.ts). */}
      {form.status === "ready" && <MorePages applicationId={form.id} />}
    </>
  );
}

function MorePages({ applicationId }: { applicationId: string }) {
  return (
    <section aria-labelledby="more-heading" className="flex flex-col gap-4 border-t border-rule pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="more-heading" className="text-lg font-semibold">
          More pages
        </h2>
        <p className="text-sm text-ink-muted">
          If the form shows more questions after you fill in these, add screenshots of the next pages.
        </p>
      </div>
      <FormPagesForm applicationId={applicationId} />
    </section>
  );
}
