import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { MonthlySpend } from "@/features/reports/components/monthly-spend";
import { ReplyRates } from "@/features/reports/components/reply-rates";
import { RunCosts } from "@/features/reports/components/run-costs";
import { getMonthlySpend, getReplyRates, getRunCosts } from "@/features/reports/data";

export const metadata: Metadata = { title: "Reports" };

const LOADING = <p className="text-ink-muted">Loading…</p>;

// Spending per run and per month, and reply and interview rates per source and per email pattern (PLAN.md item 5.3; U5).
export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Reports</h1>
      {/* Each is read per request, so it streams in behind a boundary (Cache Components). */}
      <Section id="rates-heading" title="Replies and interviews">
        <Suspense fallback={LOADING}>
          <Rates />
        </Suspense>
      </Section>
      <Section id="runs-heading" title="Nightly runs">
        <Suspense fallback={LOADING}>
          <Runs />
        </Suspense>
      </Section>
      <Suspense fallback={LOADING}>
        <Spend searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-rule pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Rates() {
  return <ReplyRates rates={await getReplyRates()} />;
}

async function Runs() {
  return <RunCosts runs={await getRunCosts()} />;
}

async function Spend({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const { month } = await searchParams;
  return <MonthlySpend spend={await getMonthlySpend(typeof month === "string" ? month : undefined)} />;
}
