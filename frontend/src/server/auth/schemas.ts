import "server-only";
import { z } from "zod";

// Contract for GET /auth/callback: where Supabase Auth sends the owner after sign-in.

// Only a path inside this app, so the callback cannot redirect anywhere else.
const InternalPathSchema = z
  .string()
  .regex(/^\/(?!\/)/, "Expected a path inside the app")
  .default("/");

export const AuthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  next: InternalPathSchema,
});
export type AuthCallbackQuery = z.infer<typeof AuthCallbackQuerySchema>;
