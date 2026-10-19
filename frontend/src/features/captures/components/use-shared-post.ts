import { useEffect, useEffectEvent } from "react";
import { SHARE_CACHE, SHARED_SCREENSHOT_KEY_PREFIX, SHARED_TEXT_KEY } from "@/lib/shared-post";

// A post shared to Shortlist from Android's share menu (PLAN.md item 2.5, C1). The service worker
// (public/sw.js) keeps it in a browser cache; the capture form takes it from there to fill itself in.

export type SharedPost = { screenshots: File[]; text: string };

/** How the capture form starts after a share. */
export type SharedForm = {
  mode: "text" | "screenshot";
  text: string;
  postUrl: string;
  screenshots: File[];
  /** Shown above the form when the share alone is not enough to capture the post. */
  notice?: string;
};

// Shorter than this, once its links are taken out, shared text is a caption with a link (as when sharing
// from the LinkedIn app), not the post itself.
const MIN_POST_LENGTH = 120;
const LINK = /https?:\/\/\S+/g;

export const LINK_ONLY_NOTICE =
  "Only a link was shared, and Shortlist never opens LinkedIn links. Share a screenshot of the post, or copy its text and share or paste that.";

export function formFromSharedPost({ screenshots, text }: SharedPost): SharedForm {
  const postUrl = text.match(LINK)?.[0] ?? "";
  if (screenshots.length > 0) return { mode: "screenshot", text: "", postUrl, screenshots };

  const isWholePost = text.replace(LINK, "").trim().length >= MIN_POST_LENGTH;
  if (isWholePost) return { mode: "text", text, postUrl, screenshots: [] };
  return { mode: "screenshot", text: "", postUrl, screenshots: [], notice: LINK_ONLY_NOTICE };
}

/** After a share (/capture?shared=1), hands the shared post to onShared once, and removes it from the cache. */
export function useSharedPost(onShared: (form: SharedForm) => void): void {
  const handleShared = useEffectEvent(onShared);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("shared")) return;
    takeSharedPost().then((post) => {
      if (post) handleShared(formFromSharedPost(post));
    });
  }, []);
}

async function takeSharedPost(): Promise<SharedPost | null> {
  if (!("caches" in window) || !(await caches.has(SHARE_CACHE))) return null;
  const cache = await caches.open(SHARE_CACHE);

  const screenshots: File[] = [];
  let text = "";
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    const key = new URL(request.url).pathname;
    if (key === SHARED_TEXT_KEY) text = await response.text();
    if (key.startsWith(SHARED_SCREENSHOT_KEY_PREFIX)) {
      const name = decodeURIComponent(response.headers.get("x-file-name") ?? "screenshot");
      screenshots.push(new File([await response.blob()], name, { type: response.headers.get("content-type") ?? "" }));
    }
  }

  await caches.delete(SHARE_CACHE);
  return { screenshots, text };
}
