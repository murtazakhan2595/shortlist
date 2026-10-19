import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/server/env";
import { getAdminClient } from "@/server/supabase/admin";
import type { DraftEmail } from "./schemas";

// The owner's Gmail, through plain calls to Google's APIs (PLAN.md item 2.3, X1, X5): one-time consent,
// a short-lived access token from the saved refresh token, and drafts. The googleapis package is not used:
// it is very large, and these few calls are all that is needed.
//
// Nothing here can send mail. Gmail's send endpoints are never called (hard rule 1; tests/rules/no-send.test.ts),
// and the language model has no access to this module (hard rule 4).

/** The only Gmail permission the app asks for: create and edit drafts. */
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

const CONSENT_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRAFTS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";

export class GmailScopeError extends Error {
  constructor(granted: string) {
    super(`The Gmail token must allow only gmail.compose, but it allows: ${granted}`);
    this.name = "GmailScopeError";
  }
}

// ---------------------------------------------------------------------------
// Consent, once
// ---------------------------------------------------------------------------

/** A random value for the consent round trip; the callback checks it came back unchanged. */
export function newConsentState(): string {
  return randomBytes(32).toString("base64url");
}

/** Google's consent page. access_type and prompt make Google return a refresh token every time. */
export function gmailConsentUrl(redirectUri: string, state: string): string {
  const url = new URL(CONSENT_URL);
  url.search = new URLSearchParams({
    client_id: googleClient().clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_COMPOSE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

/** Swaps the code Google returned for tokens, and keeps the refresh token in Supabase Vault. */
export async function saveGmailConsent(code: string, redirectUri: string): Promise<void> {
  const token = await requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  if (!token.refresh_token) throw new Error("Google returned no refresh token");

  const { error } = await getAdminClient().rpc("save_gmail_token", { token: token.refresh_token });
  if (error) throw new Error(`Could not save the Gmail token: ${error.message}`);
}

export async function isGmailConnected(): Promise<boolean> {
  return (await savedRefreshToken()) !== null;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** A short-lived token for the Gmail API, or null when the owner has not connected Gmail yet. */
export async function getGmailAccessToken(): Promise<string | null> {
  const refreshToken = await savedRefreshToken();
  if (!refreshToken) return null;
  const token = await requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  return token.access_token;
}

/**
 * The id of a draft already in Gmail to this recipient with this subject, if there is one.
 * Gmail replaces the Message-ID of every draft with its own, so a draft is found by what it says instead.
 */
export async function findDraft(accessToken: string, to: string, subject: string): Promise<string | null> {
  const url = new URL(DRAFTS_URL);
  url.searchParams.set("q", `in:drafts to:${z.email().parse(to)} subject:"${subject.replace(/"/g, "")}"`);
  const found = DraftListSchema.parse(await callGmail(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
  return found.drafts?.[0]?.id ?? null;
}

export async function createDraft(accessToken: string, email: DraftEmail): Promise<string> {
  const created = DraftSchema.parse(
    await callGmail(new URL(DRAFTS_URL), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw: Buffer.from(buildEmail(email)).toString("base64url") } }),
    }),
  );
  return created.id;
}

/**
 * The email in MIME format: a plain-text body and one attached file.
 * The subject is written by a model from a job post, which is untrusted (hard rule 4), so it is always
 * encoded: a line break in it can never start a new header such as Bcc.
 */
export function buildEmail(email: DraftEmail): string {
  const to = z.email().parse(email.to);
  const fileName = email.attachment.fileName.replace(/["\\\r\n]/g, "");
  const boundary = `shortlist-${randomBytes(12).toString("hex")}`;

  return [
    `To: ${to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(email.body, "utf8")),
    `--${boundary}`,
    `Content-Type: ${email.attachment.contentType}; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(email.attachment.content),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Google's token answer. refresh_token comes only with consent; scope lists every permission granted. */
const GoogleTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string(),
});
const DraftSchema = z.object({ id: z.string().min(1) });
const DraftListSchema = z.object({ drafts: z.array(DraftSchema).optional() });

// An encoded word may be at most 75 characters (RFC 2047), so a long subject becomes several.
const ENCODED_WORD_BYTES = 45;

/** Encodes a header value as UTF-8 encoded words, one per chunk, folded onto separate lines. */
function encodeHeader(value: string): string {
  const words: string[] = [];
  let chunk = "";
  for (const character of value.replace(/[\r\n]+/g, " ")) {
    if (Buffer.byteLength(chunk + character) > ENCODED_WORD_BYTES) {
      words.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word).toString("base64")}?=`).join("\r\n ");
}

/** Base64 in lines of 76 characters, as MIME requires. */
function base64Lines(content: Buffer): string {
  return content.toString("base64").replace(/.{76}/g, "$&\r\n").trimEnd();
}

function googleClient(): { clientId: string; clientSecret: string } {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = getServerEnv();
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set");
  return { clientId, clientSecret };
}

async function savedRefreshToken(): Promise<string | null> {
  const { data, error } = await getAdminClient().rpc("gmail_token");
  if (error) throw new Error(`Could not read the Gmail token: ${error.message}`);
  return data || null;
}

/**
 * Asks Google for tokens. Every answer lists the permissions the token carries; anything other than
 * exactly gmail.compose is refused (X5), so a token with wider access is never saved or used.
 */
async function requestToken(grant: Record<string, string>): Promise<z.infer<typeof GoogleTokenSchema>> {
  const { clientId, clientSecret } = googleClient();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ ...grant, client_id: clientId, client_secret: clientSecret }),
  });
  // Google's error answer names the problem (such as invalid_grant) and holds no token.
  if (!response.ok) throw new Error(`Google refused the token request: ${await response.text()}`);

  const token = GoogleTokenSchema.parse(await response.json());
  const scopes = token.scope.split(" ").filter(Boolean);
  if (scopes.length !== 1 || scopes[0] !== GMAIL_COMPOSE_SCOPE) throw new GmailScopeError(token.scope);
  return token;
}

async function callGmail(url: URL, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Gmail answered ${response.status}: ${await response.text()}`);
  return response.json();
}
