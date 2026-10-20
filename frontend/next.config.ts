import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // On a phone, the network drops while the app is in the background. Without this, a page refresh that
  // fails then reloads the whole page, which also fails and shows the browser's error page. With it,
  // Next.js waits for the connection and retries the refresh.
  experimental: { useOffline: true },
  // The service worker must never be cached, so a new version reaches the phone on its next visit.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
