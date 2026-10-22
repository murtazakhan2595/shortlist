import { formatUsd } from "@/lib/format";
import type { RunCost } from "../data";

const RUN_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" });

const STATUS_NAMES: Record<string, string> = { running: "not finished", failed: "failed" };

/** What each nightly run found, put on the list and cost (U5, B1). */
export function RunCosts({ runs }: { runs: RunCost[] }) {
  if (runs.length === 0) return <p className="text-ink-muted">No nightly run yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-md text-left text-sm">
        <thead className="text-ink-muted">
          <tr>
            <th scope="col" className="py-1 font-normal">Started</th>
            <th scope="col" className="py-1 text-right font-normal">Read</th>
            <th scope="col" className="py-1 text-right font-normal">Kept</th>
            <th scope="col" className="py-1 text-right font-normal">Scored</th>
            <th scope="col" className="py-1 text-right font-normal">On list</th>
            <th scope="col" className="py-1 text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-rule">
              <td className="py-1">
                {RUN_DATE.format(new Date(run.startedAt))}
                {STATUS_NAMES[run.status] && <span className="text-ink-muted">, {STATUS_NAMES[run.status]}</span>}
              </td>
              <td className="py-1 text-right">{run.fetched}</td>
              <td className="py-1 text-right">{run.kept}</td>
              <td className="py-1 text-right">{run.scored}</td>
              <td className="py-1 text-right">{run.onList}</td>
              <td className="py-1 text-right">{formatUsd(run.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
