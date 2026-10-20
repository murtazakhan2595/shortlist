"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveDocument } from "../actions";
import type { DocumentKind } from "../schemas";

/** One document as plain text, to read or edit (P6, Q8). Saving adds a new version; the old one is kept. */
export function DocumentEditor({ kind, name, content }: { kind: DocumentKind; name: string; content: string }) {
  const router = useRouter();
  const [text, setText] = useState(content);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [isPending, startTransition] = useTransition();
  const fieldId = `document-${kind}-${name}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveDocument({ kind, name, content: text });
      if (!result.ok) return setMessage({ ok: false, text: result.error.message });
      setMessage({ ok: true, text: `Saved as version ${result.data.version}.` });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Label htmlFor={fieldId} className="sr-only">
        {name}
      </Label>
      <textarea
        id={fieldId}
        required
        rows={16}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setMessage(undefined);
        }}
        className="w-full rounded-md border border-rule bg-field p-3 text-base leading-relaxed outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink"
      />
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={isPending || text === content} variant="secondary" className="h-10 sm:w-auto sm:self-start">
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
