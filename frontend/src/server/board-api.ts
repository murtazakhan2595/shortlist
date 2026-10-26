import "server-only";

const USER_AGENT = "shortlist (personal job search, one run a day)";
const TIMEOUT_MS = 15_000;

/** A company job board's public JSON. Null when the board or job no longer exists (404). */
export async function getBoardJson(url: string, provider: string): Promise<unknown | null> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${provider} answered ${response.status} for ${new URL(url).pathname}`);
  return response.json();
}
