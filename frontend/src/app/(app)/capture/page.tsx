import type { Metadata } from "next";
import { CaptureForm } from "@/features/captures/components/capture-form";

export const metadata: Metadata = { title: "Capture a post" };

// The form needs no data, so the page is static; the Server Actions behind it check the owner.
export default function CapturePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Capture a post</h1>
        <p className="text-ink-muted">Paste a LinkedIn hiring post, or add screenshots of it.</p>
      </div>
      <CaptureForm />
    </main>
  );
}
