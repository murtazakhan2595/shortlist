import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="text-ink-muted">Last updated 19 October 2026</p>

      <p>
        Shortlist is a personal, non-commercial tool used by one person, the developer who built it, for their own job
        search. It is not offered as a service to anyone else, and new accounts cannot be created.
      </p>

      <h2>You stay in control</h2>
      <p>
        Shortlist prepares drafts and answers. It never sends an email or submits a form: you review each one and
        decide whether to send it.
      </p>

      <h2>Google services</h2>
      <p>
        Creating drafts in Gmail is also subject to{" "}
        <a href="https://policies.google.com/terms">Google&apos;s Terms of Service</a>. How Shortlist uses your Google
        data is described in the <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>No warranty</h2>
      <p>Shortlist is provided as it is, without any guarantee that it is complete, correct or always available.</p>
    </>
  );
}
