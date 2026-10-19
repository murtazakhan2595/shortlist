import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { GmailConnection } from "@/features/settings/components/gmail-connection";
import { getGmailConnected } from "@/features/settings/data";
import { GMAIL_CONNECT_RESULTS } from "@/server/gmail/schemas";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      {/* The connection is read per request, so it streams in behind a boundary (Cache Components). */}
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Gmail searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Gmail({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  const [connected, { gmail }] = await Promise.all([getGmailConnected(), searchParams]);
  const result = z.enum(GMAIL_CONNECT_RESULTS).safeParse(gmail);
  return <GmailConnection connected={connected} result={result.success ? result.data : undefined} />;
}
