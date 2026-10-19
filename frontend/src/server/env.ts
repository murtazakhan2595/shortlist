import "server-only";
import { z } from "zod";

// Server settings, checked with Zod the first time they are read, so a missing or malformed
// value fails with a clear message instead of deep inside a request.

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Safe in the browser: it only allows what the owner-only access rules allow.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  // Needed only when a step calls a model, so tests and pages without model calls run without it.
  OPENAI_API_KEY: z.string().min(1).optional(),
  // A direct Postgres connection, for LangGraph's saved state (the langgraph schema). On a serverless host,
  // use Supabase's transaction pooler (port 6543). Needed only by queue steps that run a graph.
  SUPABASE_DB_URL: z.url().optional(),
  // The Bearer secret Supabase sends to /api/worker and /api/daily-run. Without it, those routes refuse every call.
  INTERNAL_API_SECRET: z.string().min(32).optional(),
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let serverEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  serverEnv ??= ServerEnvSchema.parse(process.env);
  return serverEnv;
}

/**
 * The contact address on the public privacy and terms pages, from CONTACT_EMAIL.
 * Kept out of the code because it is personal data (principle 6). Read on its own, so those pages
 * build without the database settings.
 */
export function getContactEmail(): string | undefined {
  return z.email().optional().parse(process.env.CONTACT_EMAIL || undefined);
}
