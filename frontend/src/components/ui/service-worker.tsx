"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, which receives posts shared from Android's share menu (PLAN.md item 2.5).
 * In the root layout, so the installed app has it from the first page it opens, the sign-in page included.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      // Only sharing depends on it; the rest of the app works without it.
      console.warn("The service worker could not be registered:", error);
    });
  }, []);

  return null;
}
