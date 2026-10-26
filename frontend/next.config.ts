import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Without this, a refresh that fails while a phone is offline reloads into the browser's error page.
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
