import { NextResponse } from "next/server";
import { fail } from "@/lib/result";
import { NotOwnerError, requireOwner } from "@/server/auth/require-owner";
import { gmailConsentUrl, newConsentState } from "@/server/gmail/gmail";
import { GMAIL_STATE_COOKIE } from "@/server/gmail/schemas";

// The state must come back within this time, or the owner starts again.
const STATE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(request: Request): Promise<Response> {
  try {
    await requireOwner();
  } catch (error) {
    if (error instanceof NotOwnerError) return Response.json(fail("unauthorized", error.message), { status: 403 });
    throw error;
  }

  const state = newConsentState();
  const redirectUri = new URL("/api/gmail/callback", request.url).toString();
  const response = NextResponse.redirect(gmailConsentUrl(redirectUri, state));
  response.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: redirectUri.startsWith("https:"),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return response;
}
