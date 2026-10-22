"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dismissFailedStep, retryFailedStep } from "../actions";

/**
 * Try again queues the failed step once more; Dismiss closes it without. With href, a link to the page of
 * what it was working on. The page then refreshes to show where things stand.
 */
export function FailureActions({ failedStepId, href }: { failedStepId: string; href?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function act(action: typeof retryFailedStep) {
    setError(undefined);
    startTransition(async () => {
      const result = await action({ failedStepId });
      // Already dealt with, in another tab: the refresh shows it.
      if (!result.ok && result.error.code !== "conflict") return setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" variant="secondary" className="sm:w-auto" disabled={isPending} onClick={() => act(retryFailedStep)}>
          {isPending ? "Working…" : "Try again"}
        </Button>
        <Button type="button" variant="quiet" disabled={isPending} onClick={() => act(dismissFailedStep)}>
          Dismiss
        </Button>
        {href && (
          <Link href={href} className="text-sm underline">
            Open it
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
