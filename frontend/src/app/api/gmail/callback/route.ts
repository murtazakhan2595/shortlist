import { type NextRequest, NextResponse } from "next/server";
import { queueMissingDrafts } from "@/features/applications/steps/gmail-draft";
import { describeError } from "@/lib/errors";
import { fail } from "@/lib/result";
import { saveGmailConsent } from "@/server/gmail/gmail";
import { GMAIL_STATE_COOKIE, GmailCallbackQuerySchema, type GmailConnectResult } from "@/server/gmail/schemas";

// The state must match the cookie set by /api/gmail/connect, so only a consent the owner started is accepted.
export async function GET(request: NextRequest): Promise<Response> {
  const query = GmailCallbackQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const expectedState = request.cookies.get(GMAIL_STATE_COOKIE)?.value;
  if (!query.success || !expectedState || query.data.state !== expectedState) {
    return Response.json(fail("invalid_input", "This Gmail consent was not started here, or has expired"), { status: 400 });
  }
  if ("error" in query.data) return backToSettings(request, "refused");

  try {
    await saveGmailConsent(query.data.code, new URL("/api/gmail/callback", request.url).toString());
    await queueMissingDrafts();
    return backToSettings(request, "connected");
  } catch (error) {
    console.error("Gmail consent failed:", describeError(error));
    return backToSettings(request, "failed");
  }
}

function backToSettings(request: NextRequest, result: GmailConnectResult): Response {
  const response = NextResponse.redirect(new URL(`/settings?gmail=${result}`, request.url));
  response.cookies.delete({ name: GMAIL_STATE_COOKIE, path: "/api/gmail" });
  return response;
}
