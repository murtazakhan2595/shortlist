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

/** An email to save as a draft, with one attached file. */
export type DraftEmail = {
  /** Our own Message-ID, so a retried step can find the draft it already made. */
  messageId: string;
  to: string;
  subject: string;
  body: string;
  attachment: { fileName: string; contentType: string; content: Buffer };
};

/** The cookie holding the consent state between connect and callback. */
export const GMAIL_STATE_COOKIE = "gmail_consent_state";

/** Where the callback sends the owner: /settings?gmail=<result>. */
export const GMAIL_CONNECT_RESULTS = ["connected", "refused", "failed"] as const;
export type GmailConnectResult = (typeof GMAIL_CONNECT_RESULTS)[number];
