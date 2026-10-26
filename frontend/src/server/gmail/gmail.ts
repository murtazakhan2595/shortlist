import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/server/env";
import { getAdminClient } from "@/server/supabase/admin";
import type { DraftEmail } from "./schemas";

// Gmail drafts through plain fetch calls; the googleapis package is too large for these few calls.
// Nothing here can send mail (tests/rules/no-send.test.ts checks it), and the model never reaches this module.

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

export function newConsentState(): string {
  return randomBytes(32).toString("base64url");
}

// access_type and prompt make Google return a refresh token every time.
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

export async function saveGmailConsent(code: string, redirectUri: string): Promise<void> {
  const token = await requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  if (!token.refresh_token) throw new Error("Google returned no refresh token");

  const { error } = await getAdminClient().rpc("save_gmail_token", { token: token.refresh_token });
  if (error) throw new Error(`Could not save the Gmail token: ${error.message}`);
}

export async function isGmailConnected(): Promise<boolean> {
  return (await savedRefreshToken()) !== null;
}

/** Null when Gmail is not connected yet. */
export async function getGmailAccessToken(): Promise<string | null> {
  const refreshToken = await savedRefreshToken();
  if (!refreshToken) return null;
  const token = await requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  return token.access_token;
}

// Gmail replaces every draft's Message-ID with its own, so a draft is found by recipient and subject.
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

// The subject comes from a model reading an untrusted job post, so it is always encoded:
// a line break in it can never start a new header such as Bcc.
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

// refresh_token comes only with consent; scope lists every permission granted.
const GoogleTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string(),
});
const DraftSchema = z.object({ id: z.string().min(1) });
const DraftListSchema = z.object({ drafts: z.array(DraftSchema).optional() });

// An encoded word may be at most 75 characters (RFC 2047), so a long subject becomes several.
const ENCODED_WORD_BYTES = 45;

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

// MIME requires lines of at most 76 characters.
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

// A token with any scope other than exactly gmail.compose is refused, so wider access is never saved or used.
async function requestToken(grant: Record<string, string>): Promise<z.infer<typeof GoogleTokenSchema>> {
  const { clientId, clientSecret } = googleClient();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ ...grant, client_id: clientId, client_secret: clientSecret }),
  });
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
