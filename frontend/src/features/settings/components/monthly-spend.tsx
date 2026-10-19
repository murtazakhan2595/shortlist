import Link from "next/link";
import { formatUsd } from "@/lib/format";
import type { MonthlySpend as MonthlySpendData } from "../data";

const MONTH_NAME = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-10" as "October 2026". */
function monthName(month: string): string {
  return MONTH_NAME.format(new Date(`${month}-01T00:00:00Z`));
}

/** What the model calls cost in one month, in total and per step, with a link to each month (B1). */
export function MonthlySpend({ spend }: { spend: MonthlySpendData }) {
  return (
    <section aria-labelledby="spend-heading" className="flex flex-col gap-4 border-t border-rule pt-6">
      <h2 id="spend-heading" className="text-lg font-semibold">
        Model spending
      </h2>

      <nav aria-label="Month" className="flex flex-wrap gap-2">
        {spend.months.map((month) => (
          <Link
            key={month}
            href={`/settings?month=${month}`}
            aria-current={month === spend.month ? "page" : undefined}
            className="rounded-md border border-rule px-3 py-1 text-sm text-ink-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink"
          >
            {monthName(month)}
          </Link>
        ))}
      </nav>

      <p>
        <span className="text-3xl font-bold">{formatUsd(spend.totalUsd)}</span>{" "}
        <span className="text-ink-muted">
          in {monthName(spend.month)}, {spend.calls} model {spend.calls === 1 ? "call" : "calls"}
        </span>
      </p>

      {spend.steps.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-ink-muted">
            <tr>
              <th scope="col" className="py-1 font-normal">Step</th>
              <th scope="col" className="py-1 text-right font-normal">Calls</th>
              <th scope="col" className="py-1 text-right font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {spend.steps.map((step) => (
              <tr key={step.step} className="border-t border-rule">
                <td className="py-1">{step.step}</td>
                <td className="py-1 text-right">{step.calls}</td>
                <td className="py-1 text-right">{formatUsd(step.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
