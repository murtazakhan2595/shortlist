import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

// The frame around every signed-in page. It reads no session itself: each page checks the owner
// with requireOwner(), because a layout is not re-run on every navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-rule px-5 py-3">
        <Wordmark size="small" />
        <nav className="flex items-center gap-1">
          <Link href="/settings" className={buttonVariants("quiet")}>
            Settings
          </Link>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </>
  );
}
