export const CV_VARIANTS = ["full_stack", "ai_engineer", "ai_full_stack"] as const;
export type CvVariant = (typeof CV_VARIANTS)[number];

// Written as they read mid-sentence: "your AI engineer CV".
const CV_NAMES: Record<string, string> = {
  full_stack: "full-stack",
  ai_engineer: "AI engineer",
  ai_full_stack: "AI full-stack",
};

export function cvName(variant: string): string {
  return CV_NAMES[variant] ?? variant;
}

/** For the start of a label: "Full-stack". */
export function cvTitle(variant: string): string {
  const name = cvName(variant);
  return name[0].toUpperCase() + name.slice(1);
}
