import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaptureDetails } from "@/features/captures/components/capture-details";
import { getCapture } from "@/features/captures/data";

export const metadata: Metadata = { title: "Captured post" };

export default function CapturedPostPage({ params }: PageProps<"/captures/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <Link href="/capture" className="self-start text-sm text-ink-muted hover:text-ink hover:underline">
        Capture another post
      </Link>
      <h1 className="text-2xl font-bold">Captured post</h1>
      {/* The capture is read per request, so it streams in behind a boundary (Cache Components). */}
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Capture params={params} />
      </Suspense>
    </main>
  );
}

async function Capture({ params }: { params: PageProps<"/captures/[id]">["params"] }) {
  const { id } = await params;
  const capture = await getCapture(id);
  if (!capture) notFound();
  return <CaptureDetails capture={capture} />;
}
