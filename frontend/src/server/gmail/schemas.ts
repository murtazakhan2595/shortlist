import "server-only";
import { z } from "zod";

// state must match the value set before redirecting to Google.
export const GmailCallbackQuerySchema = z.union([
  z.object({ code: z.string().min(1), state: z.string().min(1) }),
  z.object({ error: z.string().min(1), state: z.string().min(1) }),
]);
export type GmailCallbackQuery = z.infer<typeof GmailCallbackQuerySchema>;

export type DraftEmail = {
  to: string;
  subject: string;
  body: string;
  attachment: { fileName: string; contentType: string; content: Buffer };
};

export const GMAIL_STATE_COOKIE = "gmail_consent_state";

/** Sent back as /settings?gmail=<result>. */
export const GMAIL_CONNECT_RESULTS = ["connected", "refused", "failed"] as const;
export type GmailConnectResult = (typeof GMAIL_CONNECT_RESULTS)[number];
