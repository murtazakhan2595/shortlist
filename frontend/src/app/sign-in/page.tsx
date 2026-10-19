import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-6 py-12">
      <div className="flex flex-col gap-3">
        <h1>
          <Wordmark size="large" />
        </h1>
        <p className="text-ink-muted">Your job applications, prepared for you to review and send.</p>
      </div>
      <SignInForm />
      <nav aria-label="About Shortlist" className="flex gap-5 text-sm text-ink-muted">
        <Link href="/privacy" className="hover:text-ink hover:underline">
          Privacy policy
        </Link>
        <Link href="/terms" className="hover:text-ink hover:underline">
          Terms of use
        </Link>
      </nav>
    </main>
  );
}
