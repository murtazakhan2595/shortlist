import type { ReplyRate, ReplyRates as ReplyRatesData } from "../data";

/** "3 (25%)": a count and its share of those sent. */
function withShare(count: number, sent: number): string {
  return `${count} (${Math.round((count / sent) * 100)}%)`;
}

/** Reply and interview rates per source and per email pattern, over the applications marked sent (U5). */
export function ReplyRates({ rates }: { rates: ReplyRatesData }) {
  if (rates.bySource.length === 0) {
    return (
      <p className="max-w-prose text-ink-muted">
        Nothing marked sent yet. Mark applications Sent, Replied or Interview on the home page, and the rates appear here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <RateTable caption="By source" rows={rates.bySource} />
      {rates.byPattern.length > 0 && <RateTable caption="By email pattern" rows={rates.byPattern} />}
    </div>
  );
}

function RateTable({ caption, rows }: { caption: string; rows: ReplyRate[] }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="pb-2 text-left font-semibold">{caption}</caption>
      <thead className="text-ink-muted">
        <tr>
          <th scope="col" className="py-1 font-normal">Name</th>
          <th scope="col" className="py-1 text-right font-normal">Sent</th>
          <th scope="col" className="py-1 text-right font-normal">Replied</th>
          <th scope="col" className="py-1 text-right font-normal">Interviews</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-t border-rule">
            <th scope="row" className="py-1 font-normal">
              {row.name}
            </th>
            <td className="py-1 text-right">{row.sent}</td>
            <td className="py-1 text-right">{withShare(row.replied, row.sent)}</td>
            <td className="py-1 text-right">{withShare(row.interviews, row.sent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
