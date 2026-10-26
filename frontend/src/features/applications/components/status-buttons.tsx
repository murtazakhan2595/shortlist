"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateApplicationStatus } from "../actions";
import { OWNER_SET_STATUSES } from "../schemas";

type OwnerStatus = (typeof OWNER_SET_STATUSES)[number];

const LABELS: Record<OwnerStatus, string> = { sent: "Sent", skipped: "Skipped", replied: "Replied", interview: "Interview" };

/** The tap shows at once and is saved behind it. */
export function StatusButtons({ applicationId, status, name }: { applicationId: string; status: string; name: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function mark(next: OwnerStatus) {
    const previous = current;
    setCurrent(next);
    setError(undefined);
    startTransition(async () => {
      const result = await updateApplicationStatus({ applicationId, status: next });
      if (!result.ok) {
        setCurrent(previous);
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Status of ${name}`}>
        {OWNER_SET_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={current === option}
            disabled={isPending}
            onClick={() => mark(option)}
            className="h-9 cursor-pointer rounded-md border border-rule px-3 text-sm font-medium text-ink-muted outline-offset-2 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-wait aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
          >
            {LABELS[option]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
