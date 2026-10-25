// The sources listings come from, with the names and sites the app shows for them (D7).
const SOURCES: Record<string, { name: string; site: string }> = {
  himalayas: { name: "Himalayas", site: "https://himalayas.app" },
  hackernews: { name: "Hacker News", site: "https://news.ycombinator.com" },
};

/** Every source the nightly run reads, in its order: one tab each on the Jobs page, and the credit (D7). */
export const NIGHTLY_SOURCES = Object.entries(SOURCES).map(([id, source]) => ({ id, ...source }));

/** "himalayas" -> "Himalayas"; a source with no name yet as it is stored. */
export function sourceName(source: string): string {
  return SOURCES[source]?.name ?? source;
}
