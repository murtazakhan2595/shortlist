"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { JobsListView } from "../data";
import type { JobsFilters as Filters } from "../schemas";

const NIGHT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" });

const SHOW: Record<Filters["show"], string> = {
  all: "All jobs",
  undecided: "Not marked yet",
  apply: "Marked Apply",
  skip: "Marked Skip",
};

const PICKER = "flex flex-col gap-2 text-sm font-medium";
const SELECT =
  "h-12 w-full min-w-0 rounded-md border border-rule bg-field px-3 text-base font-normal text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-60";

// The choice lives in the page address, so the server loads just that night and a reload keeps it.
export function JobsFilters({ nights, filters }: Pick<JobsListView, "nights" | "filters">) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const latest = nights[0]?.id;

  function choose(next: { night: string; show: string }) {
    const params = new URLSearchParams();
    if (next.night !== latest) params.set("night", next.night);
    if (next.show !== "all") params.set("show", next.show);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-busy={isPending}>
      <label className={PICKER}>
        Night of
        <select
          className={SELECT}
          value={filters.night}
          disabled={isPending}
          onChange={(event) => choose({ night: event.target.value, show: filters.show })}
        >
          {nights.map((night) => (
            <option key={night.id} value={night.id}>
              {night.id === latest ? `${NIGHT.format(new Date(night.startedAt))}, latest` : NIGHT.format(new Date(night.startedAt))}
            </option>
          ))}
        </select>
      </label>
      <label className={PICKER}>
        Show
        <select
          className={SELECT}
          value={filters.show}
          disabled={isPending}
          onChange={(event) => choose({ night: filters.night, show: event.target.value })}
        >
          {Object.entries(SHOW).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
