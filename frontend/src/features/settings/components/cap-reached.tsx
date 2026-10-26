import Link from "next/link";
import { formatUsd } from "@/lib/format";
import type { SpendingCap } from "@/server/spending";

export function CapReached({ cap }: { cap: SpendingCap }) {
  if (!cap.reached) return null;
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md border border-ink p-4">
      <p className="font-semibold">The nightly run is paused: this month&apos;s spending reached your cap</p>
      <p className="text-sm text-ink-muted">
        {formatUsd(cap.spentUsd)} spent of {formatUsd(cap.capUsd)}. No new jobs are scored and no notes written until next
        month, or until you raise the cap in{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>
        . Captures and forms still work.
      </p>
    </div>
  );
}
