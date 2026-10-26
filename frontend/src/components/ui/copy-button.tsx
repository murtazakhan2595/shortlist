"use client";

import { useState } from "react";

const COPIED_FOR_MS = 2_000;

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="h-9 shrink-0 cursor-pointer rounded-md border border-rule px-3 text-sm font-medium text-ink outline-offset-2 hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
