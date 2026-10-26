"use client";

import { useEffect } from "react";

// In the root layout, so the installed app has it from its first page, the sign-in page included.
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
