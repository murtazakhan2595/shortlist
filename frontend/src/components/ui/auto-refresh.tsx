"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_EVERY_MS = 2_000;
// Reading takes a few seconds; a step that keeps failing is retried for about two minutes.
const GIVE_UP_AFTER_MS = 3 * 60_000;

/**
 * Re-renders the page from the server every two seconds while a post is being read, so the result
 * appears without the browser ever querying the database. Rendered only while the status is "received".
 */
export function RefreshWhileReading() {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) return clearInterval(timer);
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
