import { afterEach, describe, expect, test, vi } from "vitest";
import { buildEmail, GMAIL_COMPOSE_SCOPE, getGmailAccessToken, GmailScopeError } from "./gmail";
import type { DraftEmail } from "./schemas";

const savedToken = vi.hoisted(() => ({ value: "refresh-token" as string | null }));
vi.mock("@/server/supabase/admin", () => ({
  getAdminClient: () => ({ rpc: async () => ({ data: savedToken.value, error: null }) }),
}));
vi.mock("@/server/env", () => ({
  getServerEnv: () => ({ GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret" }),
}));

const EMAIL: DraftEmail = {
  messageId: "<application-1@shortlist.local>",
  to: "hr@acme.example",
  subject: "Application for the React role",
  body: "Hi team,\n\nMy CV is attached.",
  attachment: { fileName: "CV.pdf", contentType: "application/pdf", content: Buffer.from("%PDF-1.7 test") },
};

/** The subject as a mail client shows it, from its encoded words. */
function decodedSubject(mime: string): string {
  const header = mime.split("\r\n\r\n")[0].match(/^Subject: ([\s\S]*?)\r\n(?! )/m)?.[1] ?? "";
  return [...header.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)].map(([, word]) => Buffer.from(word, "base64").toString()).join("");
}

describe("buildEmail", () => {
  test("writes the recipient, subject, body and the attached file", () => {
    const mime = buildEmail(EMAIL);

    expect(mime).toContain("To: hr@acme.example\r\n");
    expect(mime).toContain("Message-ID: <application-1@shortlist.local>\r\n");
    expect(decodedSubject(mime)).toBe(EMAIL.subject);
    expect(mime).toContain(Buffer.from(EMAIL.body).toString("base64"));
    expect(mime).toContain('Content-Disposition: attachment; filename="CV.pdf"');
    expect(mime).toContain(EMAIL.attachment.content.toString("base64"));
  });

  test("a line break in the subject cannot add a header such as Bcc (hard rule 4)", () => {
    const mime = buildEmail({ ...EMAIL, subject: "Hello\r\nBcc: attacker@evil.example" });
    const headers = mime.split("\r\n\r\n")[0];

    expect(headers).not.toMatch(/^Bcc:/im);
    expect(decodedSubject(mime)).toBe("Hello Bcc: attacker@evil.example");
  });

  test("a long or non-English subject stays readable, in encoded words of at most 75 characters", () => {
    const subject = "Application for the Senior Full-Stack Engineer role — Karachi, Lahore and remote, ünïcödé";
    const mime = buildEmail({ ...EMAIL, subject });

    expect(decodedSubject(mime)).toBe(subject);
    for (const word of mime.match(/=\?UTF-8\?B\?[^?]*\?=/g) ?? []) expect(word.length).toBeLessThanOrEqual(75);
  });

  test("refuses a recipient that is not one email address", () => {
    expect(() => buildEmail({ ...EMAIL, to: "hr@acme.example\r\nBcc: attacker@evil.example" })).toThrow();
  });

  test("keeps every base64 line within 76 characters", () => {
    const mime = buildEmail({ ...EMAIL, attachment: { ...EMAIL.attachment, content: Buffer.alloc(5_000, 7) } });

    expect(mime.split("\r\n").every((line) => line.length <= 998)).toBe(true);
    expect(mime.split("\r\n").filter((line) => /^[A-Za-z0-9+/=]{77,}$/.test(line))).toEqual([]);
  });
});

describe("getGmailAccessToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    savedToken.value = "refresh-token";
  });

  function googleAnswers(scope: string) {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: "access-token", scope })));
  }

  test("returns an access token that allows only gmail.compose", async () => {
    googleAnswers(GMAIL_COMPOSE_SCOPE);

    await expect(getGmailAccessToken()).resolves.toBe("access-token");
  });

  test("refuses a token with any other Gmail permission (X5)", async () => {
    googleAnswers(`${GMAIL_COMPOSE_SCOPE} https://www.googleapis.com/auth/gmail.send`);

    await expect(getGmailAccessToken()).rejects.toThrow(GmailScopeError);
  });

  test("is null before the owner connects Gmail", async () => {
    savedToken.value = null;
    googleAnswers(GMAIL_COMPOSE_SCOPE);

    await expect(getGmailAccessToken()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
