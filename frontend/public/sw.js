// Shortlist's service worker (PLAN.md item 2.5). It does one thing: receive a post shared from Android's
// share menu (share_target in src/app/manifest.ts). It keeps the shared screenshots and text in a browser
// cache and opens the capture page, which fills its form from that cache. Nothing is sent to the server
// here, and nothing else is cached: every other request goes to the network as usual.
//
// A plain script, so it repeats the names in src/lib/shared-post.ts. Keep the two in step.
const SHARE_PATH = "/share";
const SHARED_SCREENSHOTS_FIELD = "screenshots";
const SHARE_CACHE = "shared-post";
const SHARED_CAPTURE_URL = "/capture?shared=1";
const SHARED_SCREENSHOT_KEY_PREFIX = "/shared/screenshot/";
const SHARED_TEXT_KEY = "/shared/text";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === SHARE_PATH) event.respondWith(keepSharedPost(event.request));
});

async function keepSharedPost(request) {
  const form = await request.formData();

  // Only the latest share is kept.
  await caches.delete(SHARE_CACHE);
  const cache = await caches.open(SHARE_CACHE);

  const screenshots = form.getAll(SHARED_SCREENSHOTS_FIELD).filter((file) => file instanceof File && file.size > 0);
  for (const [index, file] of screenshots.entries()) {
    const headers = { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) };
    await cache.put(`${SHARED_SCREENSHOT_KEY_PREFIX}${index}`, new Response(file, { headers }));
  }

  const text = ["title", "text", "url"].map((field) => String(form.get(field) ?? "").trim()).filter(Boolean);
  await cache.put(SHARED_TEXT_KEY, new Response(text.join("\n")));

  // 303 turns the POST into a GET of the capture page.
  return Response.redirect(new URL(SHARED_CAPTURE_URL, self.location.origin).href, 303);
}
