import "server-only";
import { z } from "zod";

// Server settings, checked with Zod the first time they are read, so a missing or malformed
// value fails with a clear message instead of deep inside a request.

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  // Needed only when a step calls a model, so tests and pages without model calls run without it.
  OPENAI_API_KEY: z.string().min(1).optional(),
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let serverEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  serverEnv ??= ServerEnvSchema.parse(process.env);
  return serverEnv;
}
