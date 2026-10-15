import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/server/env";
import type { Database } from "./database.types";

export type AdminClient = SupabaseClient<Database>;

let adminClient: AdminClient | undefined;

/**
 * A database client with the secret key, which bypasses the owner-only access rules.
 * For background work only (queue steps, scheduled runs); owner requests go through requireOwner().
 */
export function getAdminClient(): AdminClient {
  const env = getServerEnv();
  adminClient ??= createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}
