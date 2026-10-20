import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { requireOwner } from "@/server/auth/require-owner";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-5 py-8">
      <h1 className="text-2xl font-bold">Your applications</h1>
      <div className="my-2 flex flex-col gap-3 sm:flex-row">
        <Link href="/capture" className={`${buttonVariants()} sm:w-auto`}>
          Capture a post
        </Link>
        <Link href="/forms" className={`${buttonVariants("secondary")} sm:w-auto`}>
          Answer a form
        </Link>
      </div>
      {/* The owner check reads the session, so it streams in behind a boundary (Cache Components). */}
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Applications />
      </Suspense>
    </main>
  );
}

async function Applications() {
  await requireOwner();
  return (
    <p className="max-w-prose text-ink-muted">
      Nothing prepared yet. Posts you capture, and each morning&apos;s list of jobs, will appear here.
    </p>
  );
}
