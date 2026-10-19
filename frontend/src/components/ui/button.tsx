import type { ComponentProps } from "react";

const VARIANTS = {
  // The one main action on a screen.
  primary: "h-12 w-full rounded-md bg-ink px-5 font-semibold text-paper hover:opacity-90",
  // Secondary actions that should not compete with the content, such as signing out.
  quiet: "h-10 rounded-md px-3 font-medium text-ink-muted hover:text-ink hover:underline",
} as const;

type ButtonProps = ComponentProps<"button"> & { variant?: keyof typeof VARIANTS };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`${VARIANTS[variant]} cursor-pointer outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
