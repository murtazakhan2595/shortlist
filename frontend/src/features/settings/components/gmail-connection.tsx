import { buttonVariants } from "@/components/ui/button";
import type { GmailConnectResult } from "@/server/gmail/schemas";

const RESULT_MESSAGES: Record<GmailConnectResult, string> = {
  connected: "Gmail is connected. Ready emails are being saved as drafts.",
  refused: "Gmail was not connected, because the permission was not given.",
  failed: "Gmail could not be connected. Try again; if it keeps failing, check the server log.",
};

/** Whether drafts can be made in the owner's Gmail, and the one-time link to allow it (X1). */
export function GmailConnection({ connected, result }: { connected: boolean; result?: GmailConnectResult }) {
  return (
    <section aria-labelledby="gmail-heading" className="flex flex-col gap-3">
      <h2 id="gmail-heading" className="text-lg font-semibold">
        Gmail
      </h2>
      {result && (
        <p role={result === "connected" ? "status" : "alert"} className={result === "connected" ? "" : "text-danger"}>
          {RESULT_MESSAGES[result]}
        </p>
      )}
      <p className="max-w-prose text-ink-muted">
        {connected
          ? "Connected. Each ready email is saved as a draft in your Gmail, with its CV attached. Nothing is ever sent."
          : "Not connected. Allow Shortlist to create drafts in your Gmail; it can never send them for you."}
      </p>
      {/* A plain link: the route redirects to Google, which a client-side navigation cannot follow. */}
      <a href="/api/gmail/connect" className={`${buttonVariants(connected ? "quiet" : "primary")} sm:w-auto sm:self-start`}>
        {connected ? "Connect again" : "Connect Gmail"}
      </a>
    </section>
  );
}
