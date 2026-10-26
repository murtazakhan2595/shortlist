import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerEnv } from "@/server/env";
import type { Database } from "./database.types";

export type ServerClient = SupabaseClient<Database>;

// Owner code gets this through requireOwner(), not directly.
export async function getServerClient(): Promise<ServerClient> {
  // Cookies first: reading request data stops Next.js prerendering here, so env is never read at build time.
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Pages cannot set cookies. Safe to ignore: the proxy refreshes the session on every request.
        }
      },
    },
  });
}
