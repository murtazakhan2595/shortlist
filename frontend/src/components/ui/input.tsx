import type { ComponentProps } from "react";

// 16px text, so phones do not zoom in when the field is focused.
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`h-12 w-full rounded-md border border-rule bg-field px-3 text-base text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink aria-invalid:border-danger ${className}`}
      {...props}
    />
  );
}
