import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { GmailConnection } from "@/features/settings/components/gmail-connection";
import { MonthlySpend } from "@/features/settings/components/monthly-spend";
import { getGmailConnected, getMonthlySpend } from "@/features/settings/data";
import { GMAIL_CONNECT_RESULTS } from "@/server/gmail/schemas";

export const metadata: Metadata = { title: "Settings" };

type SearchParams = PageProps<"/settings">["searchParams"];

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      {/* Both are read per request, so they stream in behind a boundary (Cache Components). */}
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Gmail searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Spend searchParams={searchParams} />
      </Suspense>
      <div className="border-t border-rule pt-6">
        <SignOutButton />
      </div>
    </main>
  );
}

async function Gmail({ searchParams }: { searchParams: SearchParams }) {
  const [connected, { gmail }] = await Promise.all([getGmailConnected(), searchParams]);
  const result = z.enum(GMAIL_CONNECT_RESULTS).safeParse(gmail);
  return <GmailConnection connected={connected} result={result.success ? result.data : undefined} />;
}

async function Spend({ searchParams }: { searchParams: SearchParams }) {
  const { month } = await searchParams;
  const spend = await getMonthlySpend(typeof month === "string" ? month : undefined);
  return <MonthlySpend spend={spend} />;
}
