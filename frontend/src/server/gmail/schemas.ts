import "server-only";
import { z } from "zod";

// Contracts for the one-time Gmail consent (X1, X5):
//   GET /api/gmail/connect  -> redirects the owner to Google
//   GET /api/gmail/callback -> Google redirects back here with a code, or with an error if consent was refused

// state is the random value set before redirecting to Google; it must match on return.
export const GmailCallbackQuerySchema = z.union([
  z.object({ code: z.string().min(1), state: z.string().min(1) }),
  z.object({ error: z.string().min(1), state: z.string().min(1) }),
]);
export type GmailCallbackQuery = z.infer<typeof GmailCallbackQuerySchema>;
