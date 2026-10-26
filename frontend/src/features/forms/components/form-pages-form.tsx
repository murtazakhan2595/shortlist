"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { fail, type Result } from "@/lib/result";
import { uploadImages } from "@/lib/uploads";
import { addFormPages, createFormUploadUrl } from "../actions";
import { type FormPages, type FormPagesAdded, MAX_FORM_PAGES_PER_REQUEST } from "../schemas";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp";

type Mode = FormPages["inputType"];
const MODES: { value: Mode; label: string }[] = [
  { value: "screenshot", label: "Screenshots" },
  { value: "text", label: "Pasted text" },
];

/** Without an applicationId it starts a new form and opens it. */
export function FormPagesForm({ applicationId }: { applicationId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("screenshot");
  const [files, setFiles] = useState<File[]>([]);
  // A file input cannot be emptied from code, so a new key replaces it with an empty one.
  const [fileInputKey, setFileInputKey] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const id = applicationId ? "more-pages" : "pages";
  const errorId = `${id}-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      const result =
        mode === "text"
          ? await addFormPages({ applicationId, pages: { inputType: "text", text } })
          : await submitScreenshots(files, applicationId);
      if (!result.ok) return setError(result.error.message);

      if (applicationId) {
        setFiles([]);
        setFileInputKey((key) => key + 1);
        setText("");
        router.refresh();
      } else {
        router.push(`/forms/${result.data.applicationId}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-describedby={error ? errorId : undefined}>
      <ToggleGroup legend="What do you have?" name={`${id}-mode`} value={mode} options={MODES} onChange={setMode} />

      {mode === "screenshot" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>{applicationId ? "Screenshots of the next pages" : "Screenshots of the form and the job"}</Label>
          <Input
            key={fileInputKey}
            id={id}
            type="file"
            accept={ACCEPTED_IMAGES}
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="h-auto py-3 file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1 file:text-paper"
          />
          <p className="text-sm text-ink-muted">
            {applicationId
              ? `Up to ${MAX_FORM_PAGES_PER_REQUEST} at a time. Questions already listed are not added twice.`
              : `Up to ${MAX_FORM_PAGES_PER_REQUEST}, in any order: the form's pages, and the job post or description if you have them.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>{applicationId ? "The next pages" : "The form"}</Label>
          <textarea
            id={id}
            required
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the form's questions, with the job post if you have it."
            className="w-full rounded-md border border-rule bg-field p-3 text-base outline-offset-2 placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} variant={applicationId ? "secondary" : "primary"}>
        {isPending ? "Sending…" : applicationId ? "Add these pages" : "Answer the form"}
      </Button>
    </form>
  );
}

async function submitScreenshots(files: File[], applicationId: string | undefined): Promise<Result<FormPagesAdded>> {
  if (files.length === 0) return fail("invalid_input", "Choose at least one screenshot");
  if (files.length > MAX_FORM_PAGES_PER_REQUEST) {
    return fail("invalid_input", `Choose up to ${MAX_FORM_PAGES_PER_REQUEST} screenshots; add the rest on the form's page`);
  }

  const uploaded = await uploadImages(files, createFormUploadUrl);
  if (!uploaded.ok) return uploaded;
  return addFormPages({ applicationId, pages: { inputType: "screenshot", imagePaths: uploaded.data } });
}
