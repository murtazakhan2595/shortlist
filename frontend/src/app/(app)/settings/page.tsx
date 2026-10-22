import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { z } from "zod";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { CapReached } from "@/features/settings/components/cap-reached";
import { GmailConnection } from "@/features/settings/components/gmail-connection";
import { MonthlySpend } from "@/features/settings/components/monthly-spend";
import { RunSettingsForm } from "@/features/settings/components/run-settings-form";
import { StepModels } from "@/features/settings/components/step-models";
import { getGmailConnected, getMonthlySpend, getRunSettings, getSpendingCap, getStepModels } from "@/features/settings/data";
import { GMAIL_CONNECT_RESULTS } from "@/server/gmail/schemas";

export const metadata: Metadata = { title: "Settings" };

type SearchParams = PageProps<"/settings">["searchParams"];

const LOADING = <p className="text-ink-muted">Loading…</p>;

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      {/* Each is read per request, so it streams in behind a boundary (Cache Components). */}
      <Section id="run-heading" title="Nightly run">
        <Suspense fallback={LOADING}>
          <RunSettings />
        </Suspense>
      </Section>
      <Section id="models-heading" title="Models" intro="The model and reasoning effort each step uses. Only models with a known price are offered.">
        <Suspense fallback={LOADING}>
          <Models />
        </Suspense>
      </Section>
      <Suspense fallback={LOADING}>
        <Spend searchParams={searchParams} />
      </Suspense>
      <div className="border-t border-rule pt-6">
        <Suspense fallback={LOADING}>
          <Gmail searchParams={searchParams} />
        </Suspense>
      </div>
      <div className="border-t border-rule pt-6">
        <SignOutButton />
      </div>
    </main>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-rule pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {intro && <p className="text-sm text-ink-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

async function RunSettings() {
  return <RunSettingsForm settings={await getRunSettings()} />;
}

async function Models() {
  return <StepModels stepModels={await getStepModels()} />;
}

async function Gmail({ searchParams }: { searchParams: SearchParams }) {
  const [connected, { gmail }] = await Promise.all([getGmailConnected(), searchParams]);
  const result = z.enum(GMAIL_CONNECT_RESULTS).safeParse(gmail);
  return <GmailConnection connected={connected} result={result.success ? result.data : undefined} />;
}

async function Spend({ searchParams }: { searchParams: SearchParams }) {
  const { month } = await searchParams;
  const [spend, cap] = await Promise.all([getMonthlySpend(typeof month === "string" ? month : undefined), getSpendingCap()]);
  return (
    <>
      <CapReached cap={cap} />
      <MonthlySpend spend={spend} />
    </>
  );
}
