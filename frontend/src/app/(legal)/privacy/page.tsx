import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

// Every statement here must stay true of the code: the Gmail rules are REQUIREMENTS.md X1 and X5,
// and principle 4 keeps Gmail away from language models.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-ink-muted">Last updated 19 October 2026</p>

      <p>
        Shortlist is a personal tool that prepares job applications for one person, the developer who built it. It
        has no other users, and new accounts cannot be created.
      </p>

      <h2>What Shortlist does with your Google account</h2>
      <p>
        With your permission, Shortlist uses the Gmail permission <code>gmail.compose</code> for one thing: creating
        draft emails in your own Gmail account, with your CV attached, for you to review.
      </p>
      <ul>
        <li>It never sends an email. Every draft waits in Gmail until you send it yourself.</li>
        <li>It does not read, change or delete any email in your mailbox.</li>
        <li>No AI model is given access to your Gmail account or any data from it.</li>
      </ul>

      <h2>What is stored</h2>
      <p>
        Shortlist stores the job posts you give it, the drafts it prepares, and the Google access token that lets it
        create drafts. The token is kept encrypted. Everything is stored in Shortlist&apos;s own database, hosted by
        Supabase.
      </p>

      <h2>Who it is shared with</h2>
      <p>
        Nothing is sold, shared for advertising, or given to anyone else. To write a draft, the job post and your
        stored profile are sent to OpenAI&apos;s API. Data from Gmail is never sent there.
      </p>
      <p>
        Shortlist&apos;s use and transfer of information received from Google APIs to any other app will adhere to
        the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Removing access</h2>
      <p>
        You can remove Shortlist&apos;s access to Gmail at any time from{" "}
        <a href="https://myaccount.google.com/permissions">your Google account&apos;s permissions page</a>. It then
        stops working with Gmail at once.
      </p>
    </>
  );
}
