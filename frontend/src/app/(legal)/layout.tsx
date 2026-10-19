import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { getContactEmail } from "@/server/env";

// The frame for the public privacy and terms pages, which Google's consent screen links to.
// They need no sign-in (src/proxy.ts lets them through).
export default function LegalLayout({ children }: LayoutProps<"/">) {
  const contactEmail = getContactEmail();

  return (
    <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-8 px-6 py-10">
      <Link href="/sign-in" className="self-start rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ink">
        <Wordmark size="small" />
      </Link>
      <article className="flex flex-col gap-4 leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
      {contactEmail && (
        <p className="border-t border-rule pt-6 text-ink-muted">
          Questions about Shortlist: <a href={`mailto:${contactEmail}`} className="underline">{contactEmail}</a>
        </p>
      )}
    </main>
  );
}
