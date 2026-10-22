import Link from "next/link";
import type { ApplicationSummary } from "../data";
import { DAILY_LIST_DAYS } from "../schemas";
import { StatusButtons } from "./status-buttons";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Karachi" });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" });

/** "Today", "Yesterday", or "Monday 20 October", in Pakistan time. */
export function dayName(date: Date, now: Date): string {
  const key = DAY_KEY.format(date);
  if (key === DAY_KEY.format(now)) return "Today";
  if (key === DAY_KEY.format(new Date(now.getTime() - 24 * 3_600_000))) return "Yesterday";
  return DAY.format(date);
}

/** Applications by the day they were prepared, newest first (U1). */
export function DailyList({ applications, now }: { applications: ApplicationSummary[]; now: Date }) {
  if (applications.length === 0) {
    return (
      <p className="max-w-prose text-ink-muted">
        Nothing prepared in the last {DAILY_LIST_DAYS} days. Capture a post or answer a form, and each night&apos;s jobs
        appear here with their notes.
      </p>
    );
  }

  const days = Map.groupBy(applications, (application) => dayName(new Date(application.createdAt), now));
  return (
    <div className="flex flex-col gap-8">
      {[...days].map(([day, onDay]) => (
        <section key={day} aria-label={day} className="flex flex-col">
          <h2 className="pb-2 text-lg font-semibold">{day}</h2>
          <ul className="flex flex-col border-b border-rule">
            {onDay.map((application) => (
              <ApplicationRow key={application.id} application={application} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ApplicationRow({ application }: { application: ApplicationSummary }) {
  const name = [application.role, application.company].filter(Boolean).join(" at ") || FALLBACK_NAMES[application.route];
  const details = [application.source, prepared(application), ...application.tags].filter(Boolean).join(", ");
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3 border-t border-rule py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Link href={application.href} className="font-semibold underline-offset-4 hover:underline">
          {name}
        </Link>
        <p className="text-sm text-ink-muted">{details}</p>
      </div>
      {application.score !== null && (
        <p className="flex flex-col items-end">
          <span className="text-2xl leading-none font-bold tabular-nums">{application.score}</span>
          <span className="pt-1 text-xs text-ink-muted">score</span>
        </p>
      )}
      <div className="col-span-2">
        {application.status === "preparing" ? (
          <p className="text-sm text-ink-muted">Being prepared. Mark it once it is ready.</p>
        ) : (
          <StatusButtons applicationId={application.id} status={application.status} name={name} />
        )}
      </div>
    </li>
  );
}

const FALLBACK_NAMES: Record<ApplicationSummary["route"], string> = {
  email: "A captured post",
  note: "A job from the nightly list",
  form: "A form",
};

/** What was prepared, in a few words. */
export function prepared({ route, status, inGmail }: Pick<ApplicationSummary, "route" | "status" | "inGmail">): string {
  if (status === "preparing") return BEING_PREPARED[route];
  if (route === "email") {
    if (status === "blocked") return "email stopped by the checks";
    return inGmail ? "email draft in Gmail" : "email ready";
  }
  if (route === "note") return status === "blocked" ? "no note" : "note to paste";
  return "form answers to copy";
}

const BEING_PREPARED: Record<ApplicationSummary["route"], string> = {
  email: "email being written",
  note: "note being written",
  form: "form being answered",
};
