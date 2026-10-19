import type { ComponentProps } from "react";

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return <label className={`text-sm font-medium text-ink ${className}`} {...props} />;
}
