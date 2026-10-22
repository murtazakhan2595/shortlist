import Link from "next/link";
import { HeaderNav, TabBar } from "@/components/ui/app-nav";
import { Wordmark } from "@/components/ui/wordmark";

// The frame around every signed-in page. It reads no session itself: each page checks the owner
// with requireOwner(), because a layout is not re-run on every navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-rule px-5 py-3">
        <Link href="/" aria-label="Shortlist, home" className="rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink">
          <Wordmark size="small" />
        </Link>
        <HeaderNav />
      </header>
      {children}
      <TabBar />
    </>
  );
}
