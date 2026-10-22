"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { fail, ok, type Result } from "@/lib/result";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { createCvUploadUrl, saveCvFile } from "../actions";
import { CV_VARIANTS, type CvVariant } from "../schemas";

const VARIANT_NAMES: Record<CvVariant, string> = {
  full_stack: "Full-stack",
  ai_engineer: "AI engineer",
  ai_full_stack: "AI full-stack",
};

/** The current CV of each kind, and a way to replace it with a new PDF (P2). */
export function CvFiles({ cvs }: { cvs: { variant: string; fileName: string }[] }) {
  return (
    <ul className="flex flex-col">
      {CV_VARIANTS.map((variant) => (
        <CvRow key={variant} variant={variant} fileName={cvs.find((cv) => cv.variant === variant)?.fileName ?? null} />
      ))}
    </ul>
  );
}

function CvRow({ variant, fileName }: { variant: CvVariant; fileName: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [isPending, startTransition] = useTransition();
  const fieldId = `cv-${variant}`;

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await uploadCv(variant, file);
      if (!result.ok) return setMessage({ ok: false, text: result.error.message });
      setMessage({ ok: true, text: `${file.name} is now your ${VARIANT_NAMES[variant].toLowerCase()} CV.` });
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 border-t border-rule py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{VARIANT_NAMES[variant]}</span>
        <span className="text-sm break-all text-ink-muted">{fileName ?? "None yet"}</span>
      </div>
      <label htmlFor={fieldId} className="sr-only">
        New {VARIANT_NAMES[variant].toLowerCase()} CV
      </label>
      <Input
        id={fieldId}
        type="file"
        accept="application/pdf"
        disabled={isPending}
        onChange={upload}
        className="h-auto py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1 file:text-paper"
      />
      {isPending && <p className="text-sm text-ink-muted">Uploading…</p>}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </li>
  );
}

/** Uploads the PDF straight to storage through a one-time link, then makes it the current CV of its kind. */
async function uploadCv(variant: CvVariant, file: File): Promise<Result<null>> {
  if (file.type !== "application/pdf") return fail("invalid_input", "Choose a PDF file");
  if (file.size > MAX_UPLOAD_BYTES) return fail("invalid_input", "The CV must be under 10 MB");

  const upload = await createCvUploadUrl({ fileName: file.name, contentType: "application/pdf", sizeBytes: file.size });
  if (!upload.ok) return upload;
  const response = await fetch(upload.data.signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
  if (!response.ok) return fail("internal", `Could not upload ${file.name}`);

  const saved = await saveCvFile({ variant, fileName: file.name, storagePath: upload.data.path });
  return saved.ok ? ok(null) : saved;
}
