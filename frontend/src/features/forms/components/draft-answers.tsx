"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Button } from "@/components/ui/button";
import { draftListingAnswers } from "../actions";

/** A form started from a job, with its application's status. */
export type ListingForm = { id: string; status: string };

// Answers cost model calls, so they are drafted only when asked.
export function DraftAnswers({ listingId, form }: { listingId: string; form: ListingForm | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  if (form?.status === "blocked") return <p className="text-sm text-ink-muted">No answers: the job has closed on Greenhouse.</p>;
  if (form) {
    const drafting = form.status === "preparing";
    return (
      <p className="text-sm">
        {drafting ? "Drafting answers to its questions… " : "Answers drafted. "}
        <Link href={`/forms/${form.id}`} className="underline">
          Open the answers
        </Link>
        {drafting && <AutoRefresh />}
      </p>
    );
  }

  function draft() {
    setError(undefined);
    startTransition(async () => {
      const result = await draftListingAnswers({ listingId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" className="sm:w-auto sm:self-start" disabled={isPending} onClick={draft}>
        {isPending ? "Starting…" : "Draft answers"}
      </Button>
      <p className="text-sm text-ink-muted">
        Reads this job&apos;s application questions from Greenhouse and answers them from your profile, for about 6 cents.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
