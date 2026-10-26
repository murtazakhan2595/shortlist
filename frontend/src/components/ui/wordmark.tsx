const SIZES = {
  large: "text-5xl tracking-tight",
  small: "text-xl",
} as const;

export function Wordmark({ size }: { size: keyof typeof SIZES }) {
  return (
    <span
      className={`${SIZES[size]} inline-block bg-linear-to-b from-transparent from-55% to-highlight to-55% px-1 font-bold text-ink`}
    >
      Shortlist
    </span>
  );
}
