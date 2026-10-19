"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmCaptureEmail } from "../actions";

const ERROR_ID = "confirm-email-error";

/** The email read from a screenshot, for the owner to check or correct before anything is written (C4). */
export function ConfirmEmailForm({ captureId, email }: { captureId: string; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(email);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await confirmCaptureEmail({ captureId, email: value.trim() });
      if (!result.ok) return setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Label htmlFor="email">Email address read from the screenshot</Label>
      <Input
        id="email"
        type="email"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ERROR_ID : undefined}
      />
      <p className="text-sm text-ink-muted">Check it against the post, letter by letter. Correct it here if needed.</p>
      {error && (
        <p id={ERROR_ID} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Confirming…" : "Confirm email"}
      </Button>
    </form>
  );
}
