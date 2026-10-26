import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "h-12 w-full rounded-md bg-ink px-5 font-semibold text-paper hover:opacity-90",
  secondary: "h-12 w-full rounded-md border border-ink px-5 font-semibold text-ink hover:bg-field",
  quiet: "h-10 rounded-md px-3 font-medium text-ink-muted hover:text-ink hover:underline",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

// Also used for links that look like buttons.
export function buttonVariants(variant: ButtonVariant = "primary"): string {
  return `${VARIANTS[variant]} inline-flex cursor-pointer items-center justify-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`${buttonVariants(variant)} ${className}`} {...props} />;
}
