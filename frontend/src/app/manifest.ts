import type { MetadataRoute } from "next";
import { SHARE_PATH, SHARED_SCREENSHOTS_FIELD } from "@/lib/shared-post";

// Installed from Chrome on Android, the app appears in the share menu: a share is posted to SHARE_PATH,
// where public/sw.js keeps it and opens the capture page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shortlist",
    short_name: "Shortlist",
    description: "Daily job applications, prepared for review.",
    start_url: "/",
    display: "standalone",
    // --paper from globals.css.
    background_color: "#f3f5f7",
    theme_color: "#f3f5f7",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: SHARE_PATH,
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: SHARED_SCREENSHOTS_FIELD, accept: ["image/png", "image/jpeg", "image/webp"] }],
      },
    },
  };
}
