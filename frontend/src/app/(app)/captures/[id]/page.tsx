import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApplicationDraft } from "@/features/applications/components/application-draft";
import { getApplicationForCapture } from "@/features/applications/data";
import { CaptureDetails } from "@/features/captures/components/capture-details";
import { FailureNotice } from "@/features/failed-steps/components/failure-notice";
import { getCapture } from "@/features/captures/data";

export const metadata: Metadata = { title: "Captured post" };

export default function CapturedPostPage({ params }: PageProps<"/captures/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <Link href="/capture" className="self-start text-sm text-ink-muted hover:text-ink hover:underline">
        Capture another post
      </Link>
      <h1 className="text-2xl font-bold">Captured post</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Capture params={params} />
      </Suspense>
    </main>
  );
}

async function Capture({ params }: { params: PageProps<"/captures/[id]">["params"] }) {
  const { id } = await params;
  const [capture, application] = await Promise.all([getCapture(id), getApplicationForCapture(id)]);
  if (!capture) notFound();
  // One step at a time works on a capture, so at most one of them has failed.
  const failure = capture.failure ?? application?.failure;
  const failureNotice = failure && <FailureNotice failure={failure} />;
  return (
    <>
      <CaptureDetails capture={capture} failureNotice={failureNotice} />
      {application && <ApplicationDraft application={application} failureNotice={failureNotice} />}
    </>
  );
}
