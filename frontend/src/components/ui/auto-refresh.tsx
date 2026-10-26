"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_EVERY_MS = 2_000;
// A form of several pages takes a few minutes, one page per step; a failing step is retried for several more.
const GIVE_UP_AFTER_MS = 10 * 60_000;

// Refreshes from the server, so the browser never queries the database. Paused while the page is hidden.
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let startedAt = Date.now();
    // After giving up, the timer keeps running but does nothing, so coming back can start it again.
    const timer = setInterval(() => {
      if (document.hidden || Date.now() - startedAt > GIVE_UP_AFTER_MS) return;
      router.refresh();
    }, REFRESH_EVERY_MS);

    function onVisible() {
      if (document.hidden) return;
      startedAt = Date.now();
      router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
