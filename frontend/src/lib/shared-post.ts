// Names shared by the install manifest (app/manifest.ts), the service worker (public/sw.js, which repeats
// them because it is a plain script) and the capture form that picks up a shared post (PLAN.md item 2.5).

/** Where Android posts a shared screenshot or text. Only the service worker answers it. */
export const SHARE_PATH = "/share";
/** The form field Android puts shared images in. */
export const SHARED_SCREENSHOTS_FIELD = "screenshots";
/** The browser cache the service worker keeps a shared post in, until the capture form takes it. */
export const SHARE_CACHE = "shared-post";
/** The capture page's address after a share: /capture?shared=1. */
export const SHARED_CAPTURE_URL = "/capture?shared=1";
/** Cache keys: one per screenshot, in the order shared, then the shared text. */
export const SHARED_SCREENSHOT_KEY_PREFIX = "/shared/screenshot/";
export const SHARED_TEXT_KEY = "/shared/text";
