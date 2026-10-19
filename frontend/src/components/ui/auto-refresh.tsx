"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_EVERY_MS = 2_000;
// Background work takes seconds to a minute; a step that keeps failing is retried for about two minutes.
const GIVE_UP_AFTER_MS = 3 * 60_000;

/**
 * Re-renders the page from the server every two seconds while background work runs, so its result
 * appears without the browser ever querying the database. Render it only while there is work to wait for.
 */
export function AutoRefresh() {
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
