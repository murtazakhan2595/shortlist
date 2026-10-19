"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fail, type Result } from "@/lib/result";
import { type ImageUploadRequest, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { createCaptureUploadUrl, submitCapture } from "../actions";
import { MAX_SCREENSHOTS_PER_CAPTURE, type SubmitCaptureInput } from "../schemas";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp";
const ERROR_ID = "capture-error";

type Mode = "text" | "screenshot";

export function CaptureForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const postUrl = String(form.get("postUrl") ?? "").trim() || undefined;

    startTransition(async () => {
      setError(undefined);
      const result =
        mode === "text"
          ? await submitCapture({ inputType: "text", text: String(form.get("text") ?? ""), postUrl })
          : await submitScreenshots(files, postUrl);

      if (!result.ok) return setError(result.error.message);
      router.push(`/captures/${result.data.captureId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-describedby={error ? ERROR_ID : undefined}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">What do you have?</legend>
        <div className="grid grid-cols-2 rounded-md border border-rule bg-field p-1">
          <ModeOption mode="text" current={mode} onSelect={setMode} label="Pasted text" />
          <ModeOption mode="screenshot" current={mode} onSelect={setMode} label="Screenshots" />
        </div>
      </fieldset>

      {mode === "text" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="text">The post</Label>
          <textarea
            id="text"
            name="text"
            required
            rows={10}
            placeholder="Paste the whole post, including any email address or link."
            className="w-full rounded-md border border-rule bg-field p-3 text-base outline-offset-2 placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="screenshots">Screenshots of the post</Label>
          <Input
            id="screenshots"
            type="file"
            accept={ACCEPTED_IMAGES}
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="h-auto py-3 file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1 file:text-paper"
          />
          <p className="text-sm text-ink-muted">
            Up to {MAX_SCREENSHOTS_PER_CAPTURE}, in reading order. Make sure the email address is in one of them.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="postUrl">Link to the post (optional)</Label>
        <Input id="postUrl" name="postUrl" type="url" inputMode="url" placeholder="https://www.linkedin.com/posts/…" />
        <p className="text-sm text-ink-muted">Kept for your reference only. Shortlist never opens it.</p>
      </div>

      {error && (
        <p id={ERROR_ID} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Read the post"}
      </Button>
    </form>
  );
}

function ModeOption({
  mode,
  current,
  onSelect,
  label,
}: {
  mode: Mode;
  current: Mode;
  onSelect: (mode: Mode) => void;
  label: string;
}) {
  const selected = mode === current;
  return (
    <label
      className={`flex h-10 cursor-pointer items-center justify-center rounded text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-ink ${
        selected ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"
      }`}
    >
      <input type="radio" name="mode" value={mode} checked={selected} onChange={() => onSelect(mode)} className="sr-only" />
      {label}
    </label>
  );
}

/** Uploads each screenshot straight to storage through a one-time link, then submits their paths. */
async function submitScreenshots(files: File[], postUrl: string | undefined): Promise<Result<{ captureId: string }>> {
  if (files.length === 0) return fail("invalid_input", "Choose at least one screenshot");
  if (files.length > MAX_SCREENSHOTS_PER_CAPTURE) {
    return fail("invalid_input", `Choose up to ${MAX_SCREENSHOTS_PER_CAPTURE} screenshots`);
  }
  if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) return fail("invalid_input", "Each screenshot must be under 10 MB");

  const imagePaths: string[] = [];
  for (const file of files) {
    const upload = await createCaptureUploadUrl({
      fileName: file.name,
      // Checked on the server: any other type gets a clear "not allowed" message back.
      contentType: file.type as ImageUploadRequest["contentType"],
      sizeBytes: file.size,
    });
    if (!upload.ok) return upload;

    const response = await fetch(upload.data.signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
    if (!response.ok) return fail("internal", `Could not upload ${file.name}`);
    imagePaths.push(upload.data.path);
  }

  const input: SubmitCaptureInput = { inputType: "screenshot", imagePaths, postUrl };
  return submitCapture(input);
}
