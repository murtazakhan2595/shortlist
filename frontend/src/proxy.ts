import type { NextRequest } from "next/server";
import { redirectKeepingSession, updateSession } from "@/server/supabase/proxy";

// Runs before every page (Next.js Proxy). Signed-out visitors go to the sign-in page;
// the owner check itself happens in requireOwner(), close to the data.

const SIGN_IN_PATH = "/sign-in";
const HOME_PATH = "/";
// Open to everyone, signed in or not: Google's consent screen links to them.
const PUBLIC_PATHS = new Set(["/privacy", "/terms"]);

export async function proxy(request: NextRequest) {
  const session = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (PUBLIC_PATHS.has(path)) return session.response;

  const onSignInPage = path === SIGN_IN_PATH;

  if (!session.isSignedIn && !onSignInPage) return redirectKeepingSession(request, session, SIGN_IN_PATH);
  if (session.isSignedIn && onSignInPage) return redirectKeepingSession(request, session, HOME_PATH);
  return session.response;
}

export const config = {
  // Route handlers check their own callers (the internal secret or requireOwner), and static files need no session.
  // The install files are open too: Chrome fetches the manifest and its icons without the session cookie.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
