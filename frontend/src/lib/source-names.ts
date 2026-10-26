const SOURCES: Record<string, { name: string; site: string }> = {
  himalayas: { name: "Himalayas", site: "https://himalayas.app" },
  hackernews: { name: "Hacker News", site: "https://news.ycombinator.com" },
  greenhouse: { name: "Greenhouse", site: "https://www.greenhouse.com" },
  lever: { name: "Lever", site: "https://www.lever.co" },
  ashby: { name: "Ashby", site: "https://www.ashbyhq.com" },
};

/** In the nightly run's order. */
export const NIGHTLY_SOURCES = Object.entries(SOURCES).map(([id, source]) => ({ id, ...source }));

export function sourceName(source: string): string {
  return SOURCES[source]?.name ?? source;
}
