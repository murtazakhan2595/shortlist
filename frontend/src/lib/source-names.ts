// The names the app shows for the sources listings come from (D7).
const SOURCE_NAMES: Record<string, string> = { himalayas: "Himalayas" };

/** "himalayas" -> "Himalayas"; a source with no name yet as it is stored. */
export function sourceName(source: string): string {
  return SOURCE_NAMES[source] ?? source;
}
