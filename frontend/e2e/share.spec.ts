import { expect, test } from "@playwright/test";

// The installable app and Android's share menu (PLAN.md item 2.5). A real phone share cannot be driven
// from a test, so this posts the same form Android posts, to the real service worker.

test("the install manifest is open without signing in, and offers Shortlist as a share target", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Shortlist", display: "standalone", share_target: { action: "/share", method: "POST" } });
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.headers()["content-type"], icon.src).toBe("image/png");
  }
});

test("the service worker keeps a shared screenshot and its link, and opens the capture page", async ({ page }) => {
  await page.goto("/sign-in");
  // The worker takes control of the page once it is active.
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && navigator.serviceWorker.controller !== null);

  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append("screenshots", new File(["fake png bytes"], "post.png", { type: "image/png" }));
    form.append("text", "Check out this post https://lnkd.in/abc");
    const response = await fetch("/share", { method: "POST", body: form, redirect: "manual" });

    const cache = await caches.open("shared-post");
    const keys = (await cache.keys()).map((request) => new URL(request.url).pathname);
    const screenshot = await (await cache.match("/shared/screenshot/0"))?.text();
    const text = await (await cache.match("/shared/text"))?.text();
    return { type: response.type, keys, screenshot, text };
  });

  // A redirect the page may not read: the worker answered with 303 to /capture?shared=1.
  expect(result.type).toBe("opaqueredirect");
  expect(result.keys).toEqual(["/shared/screenshot/0", "/shared/text"]);
  expect(result.screenshot).toBe("fake png bytes");
  expect(result.text).toBe("Check out this post https://lnkd.in/abc");
});
