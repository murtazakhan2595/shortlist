"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { answerFormQuestion } from "../actions";

export function OwnerAnswerForm({ formAnswerId, initialAnswer = "" }: { formAnswerId: string; initialAnswer?: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState(initialAnswer);
  const [saveToAnswerBank, setSaveToAnswerBank] = useState(true);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const fieldId = `answer-${formAnswerId}`;
  const errorId = `${fieldId}-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      const result = await answerFormQuestion({ formAnswerId, answer, saveToAnswerBank });
      if (!result.ok) return setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Label htmlFor={fieldId} className="sr-only">
        Your answer
      </Label>
      <textarea
        id={fieldId}
        required
        rows={answerRows(initialAnswer)}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Your answer"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded-md border border-rule bg-field p-3 text-base outline-offset-2 placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink aria-invalid:border-danger"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={saveToAnswerBank}
          onChange={(event) => setSaveToAnswerBank(event.target.checked)}
          className="size-4 accent-ink"
        />
        Save to my answer bank for next time
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending} variant="secondary" className="h-10 sm:w-auto sm:self-start">
        {isPending ? "Saving…" : "Save answer"}
      </Button>
    </form>
  );
}

/** Room for a draft without scrolling: about one row per 60 characters, between 2 and 8. */
function answerRows(text: string): number {
  return Math.min(8, Math.max(2, Math.ceil(text.length / 60)));
}
