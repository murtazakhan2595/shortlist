"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryFailedStep } from "../actions";

/** Queues the failed step again; the page then shows it working. */
export function TryAgainButton({ failedStepId }: { failedStepId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function tryAgain() {
    setError(undefined);
    startTransition(async () => {
      const result = await retryFailedStep({ failedStepId });
      if (!result.ok && result.error.code !== "conflict") {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" className="sm:w-auto sm:self-start" disabled={isPending} onClick={tryAgain}>
        {isPending ? "Trying again…" : "Try again"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
