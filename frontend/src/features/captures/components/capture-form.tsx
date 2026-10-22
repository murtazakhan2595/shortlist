"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { fail, type Result } from "@/lib/result";
import { uploadImages } from "@/lib/uploads";
import { createCaptureUploadUrl, submitCapture } from "../actions";
import { type CaptureSubmitted, MAX_SCREENSHOTS_PER_CAPTURE, type SubmitCaptureInput } from "../schemas";
import { useSharedPost } from "./use-shared-post";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp";
const ERROR_ID = "capture-error";

type Mode = "text" | "screenshot";
const MODES: { value: Mode; label: string }[] = [
  { value: "text", label: "Pasted text" },
  { value: "screenshot", label: "Screenshots" },
];

export function CaptureForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // Arriving from Android's share menu, the form starts with what was shared (item 2.5).
  useSharedPost((shared) => {
    setMode(shared.mode);
    setText(shared.text);
    setPostUrl(shared.postUrl);
    setFiles(shared.screenshots);
    setNotice(shared.notice);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const link = postUrl.trim() || undefined;

    startTransition(async () => {
      setError(undefined);
      const result =
        mode === "text"
          ? await submitCapture({ inputType: "text", text, postUrl: link })
          : await submitScreenshots(files, link);

      if (!result.ok) return setError(result.error.message);
      router.push(`/captures/${result.data.captureId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-describedby={error ? ERROR_ID : undefined}>
      {notice && (
        <p role="status" className="rounded-md border border-rule bg-field p-3 text-sm">
          {notice}
        </p>
      )}

      <ToggleGroup legend="What do you have?" name="mode" value={mode} options={MODES} onChange={setMode} />

      {mode === "text" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="text">The post</Label>
          <textarea
            id="text"
            name="text"
            required
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
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
          {/* Shared screenshots are not in the file input, which a page cannot fill, so they are listed here. */}
          {files.length > 0 && (
            <p className="text-sm">Ready to send: {files.map((file) => file.name).join(", ")}</p>
          )}
          <p className="text-sm text-ink-muted">
            Up to {MAX_SCREENSHOTS_PER_CAPTURE}, in reading order. Make sure the email address is in one of them.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="postUrl">Link to the post (optional)</Label>
        <Input
          id="postUrl"
          name="postUrl"
          type="url"
          inputMode="url"
          placeholder="https://www.linkedin.com/posts/…"
          value={postUrl}
          onChange={(event) => setPostUrl(event.target.value)}
        />
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

/** Uploads the screenshots, then submits their paths as one capture. */
async function submitScreenshots(files: File[], postUrl: string | undefined): Promise<Result<CaptureSubmitted>> {
  if (files.length === 0) return fail("invalid_input", "Choose at least one screenshot");
  if (files.length > MAX_SCREENSHOTS_PER_CAPTURE) {
    return fail("invalid_input", `Choose up to ${MAX_SCREENSHOTS_PER_CAPTURE} screenshots`);
  }

  const uploaded = await uploadImages(files, createCaptureUploadUrl);
  if (!uploaded.ok) return uploaded;

  const input: SubmitCaptureInput = { inputType: "screenshot", imagePaths: uploaded.data, postUrl };
  return submitCapture(input);
}
