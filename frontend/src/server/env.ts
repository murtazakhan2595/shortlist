import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Safe in the browser: it only allows what the owner-only access rules allow.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  // Optional so tests and pages without model calls run without it.
  OPENAI_API_KEY: z.string().min(1).optional(),
  // For LangGraph's saved state. On a serverless host, use Supabase's transaction pooler (port 6543).
  SUPABASE_DB_URL: z.url().optional(),
  // The Bearer secret Supabase sends to /api/worker. Without it, the worker refuses every call.
  INTERNAL_API_SECRET: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().endsWith(".apps.googleusercontent.com").optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let serverEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  serverEnv ??= ServerEnvSchema.parse(process.env);
  return serverEnv;
}

// Read on its own, so the public privacy and terms pages build without the database settings.
export function getContactEmail(): string | undefined {
  return z.email().optional().parse(process.env.CONTACT_EMAIL || undefined);
}
