import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

const NAV_LINK = "rounded-md px-2 py-2 text-sm font-medium text-ink-muted outline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-ink";

// The frame around every signed-in page. It reads no session itself: each page checks the owner
// with requireOwner(), because a layout is not re-run on every navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-rule px-5 py-3">
        <Link href="/" aria-label="Shortlist, home" className="rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink">
          <Wordmark size="small" />
        </Link>
        <nav className="flex items-center">
          <Link href="/forms" className={NAV_LINK}>
            Forms
          </Link>
          <Link href="/profile" className={NAV_LINK}>
            Profile
          </Link>
          <Link href="/settings" className={NAV_LINK}>
            Settings
          </Link>
        </nav>
      </header>
      {children}
    </>
  );
}
