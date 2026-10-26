import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DailyList } from "@/features/applications/components/daily-list";
import { getRecentApplications } from "@/features/applications/data";
import { getLatestRunWarning } from "@/features/discovery/data";
import { FailureNotice } from "@/features/failed-steps/components/failure-notice";
import { getOpenFailures } from "@/features/failed-steps/data";
import { CapReached } from "@/features/settings/components/cap-reached";
import { getSpendingCap } from "@/features/settings/data";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Your applications</h1>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/capture" className={`${buttonVariants()} sm:w-auto`}>
          Capture a post
        </Link>
        <Link href="/forms" className={`${buttonVariants("secondary")} sm:w-auto`}>
          Answer a form
        </Link>
      </div>
      <Suspense fallback={null}>
        <NeedsAttention />
      </Suspense>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Applications />
      </Suspense>
    </main>
  );
}

async function NeedsAttention() {
  const [failures, warning, cap] = await Promise.all([getOpenFailures(), getLatestRunWarning(), getSpendingCap()]);
  if (failures.length === 0 && !warning && !cap.reached) return null;
  return (
    <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
      <h2 id="attention-heading" className="text-lg font-semibold">
        Needs your attention
      </h2>
      <CapReached cap={cap} />
      {warning && (
        <p role="alert" className="text-danger">
          <span className="font-semibold">{warning}</span>{" "}
          <Link href="/jobs" className="underline">
            Open Jobs
          </Link>
        </p>
      )}
      {failures.map((failure) => (
        <FailureNotice key={failure.id} failure={failure} href={failure.href} />
      ))}
    </section>
  );
}

async function Applications() {
  return <DailyList applications={await getRecentApplications()} now={new Date()} />;
}
