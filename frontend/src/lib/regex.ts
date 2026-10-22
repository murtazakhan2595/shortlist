/** The text with every character that means something in a regular expression escaped, so it matches only itself. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
