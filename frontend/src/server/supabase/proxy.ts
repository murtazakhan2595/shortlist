import "server-only";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/server/env";
import type { Database } from "./database.types";

export type SessionCheck = { response: NextResponse; isSignedIn: boolean };

// The optimistic check: it reads only the session, never the database. requireOwner() checks the owner.
export async function updateSession(request: NextRequest): Promise<SessionCheck> {
  const env = getServerEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          // The refreshed cookie goes on the request, so the page sees it, and on the response,
          // so the browser keeps it. The headers stop any cache from serving one session to someone else.
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Nothing may run between creating the client and this call, or a refreshed session can be lost.
  const { data } = await supabase.auth.getClaims();
  return { response, isSignedIn: Boolean(data?.claims.sub) };
}

export function redirectKeepingSession(request: NextRequest, check: SessionCheck, path: string): NextResponse {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of check.response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = check.response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
