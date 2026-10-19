import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerEnv } from "@/server/env";
import type { Database } from "./database.types";

export type ServerClient = SupabaseClient<Database>;

/**
 * A database client acting as whoever is signed in, read from the session cookie.
 * It obeys the owner-only access rules. Owner code gets it through requireOwner(), not directly.
 */
export async function getServerClient(): Promise<ServerClient> {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Pages cannot set cookies, only Server Actions and route handlers can.
          // That is safe to ignore: the proxy refreshes the session on every request.
        }
      },
    },
  });
}
