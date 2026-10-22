"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

type NavLink = {
  href: string;
  label: string;
  /** Other paths in the same section, such as a captured post under Capture. */
  alsoCovers?: string[];
  /** Used every day, so on a phone it sits in the bar at the bottom; the others stay in the header. */
  onTabBar: boolean;
};

const LINKS: NavLink[] = [
  { href: "/", label: "Home", onTabBar: true },
  { href: "/jobs", label: "Jobs", onTabBar: true },
  { href: "/capture", label: "Capture", alsoCovers: ["/captures"], onTabBar: true },
  { href: "/forms", label: "Forms", onTabBar: true },
  { href: "/reports", label: "Reports", onTabBar: false },
  { href: "/profile", label: "Profile", onTabBar: false },
  { href: "/settings", label: "Settings", onTabBar: false },
];

const FOCUS = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink";

const PLACES = {
  header: {
    links: LINKS,
    linkClass: (link: NavLink) =>
      `${link.onTabBar ? "hidden sm:inline-flex" : "inline-flex"} rounded-md px-2 py-2 text-sm font-medium text-ink-muted underline-offset-8 hover:text-ink hover:underline aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-2 ${FOCUS}`,
  },
  tabBar: {
    links: LINKS.filter((link) => link.onTabBar),
    linkClass: () =>
      `relative flex h-14 items-center justify-center text-sm font-medium text-ink-muted before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:before:bg-ink ${FOCUS} focus-visible:-outline-offset-4`,
  },
} as const;

type Place = keyof typeof PLACES;

/** True when the page at `pathname` belongs to the link's section. */
function isCurrent(link: NavLink, pathname: string | null): boolean {
  if (pathname === null) return false;
  if (link.href === "/") return pathname === "/";
  return [link.href, ...(link.alsoCovers ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function NavLinks({ place, pathname }: { place: Place; pathname: string | null }) {
  const { links, linkClass } = PLACES[place];
  return links.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      aria-current={isCurrent(link, pathname) ? "page" : undefined}
      className={linkClass(link)}
    >
      {link.label}
    </Link>
  ));
}

function CurrentNavLinks({ place }: { place: Place }) {
  return <NavLinks place={place} pathname={usePathname()} />;
}

/**
 * The links, with the current section marked. A page with an id in its path (a captured post, a form) is
 * only known per request, so the path is read behind a boundary and the links show unmarked until then
 * (Cache Components).
 */
function LinksWithCurrent({ place }: { place: Place }) {
  return (
    <Suspense fallback={<NavLinks place={place} pathname={null} />}>
      <CurrentNavLinks place={place} />
    </Suspense>
  );
}

/** The links in the header. On a phone only the ones not on the tab bar show here. */
export function HeaderNav() {
  return (
    <nav aria-label="Main" className="flex items-center">
      <LinksWithCurrent place="header" />
    </nav>
  );
}

/**
 * The bar fixed to the bottom of a phone screen. The installed app has no browser back button or
 * address bar, so every page used daily must be one tap away.
 */
export function TabBar() {
  return (
    <>
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <LinksWithCurrent place="tabBar" />
      </nav>
      {/* Keeps the end of every page clear of the fixed bar. */}
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] shrink-0 sm:hidden" />
    </>
  );
}
