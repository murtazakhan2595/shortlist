import Link from "next/link";
import type { FormSummary } from "../data";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** The latest forms, to go back to one and finish it. */
export function RecentForms({ forms }: { forms: FormSummary[] }) {
  if (forms.length === 0) return <p className="text-ink-muted">No forms yet. Forms you add appear here.</p>;

  return (
    <ul className="flex flex-col">
      {forms.map((form) => (
        <li key={form.id} className="border-t border-rule">
          <Link href={`/forms/${form.id}`} className="flex flex-col gap-1 py-3 hover:underline">
            <span className="font-medium">{formTitle(form)}</span>
            <span className="text-sm text-ink-muted">
              {DATE.format(new Date(form.createdAt))}, {form.questions} {form.questions === 1 ? "question" : "questions"}
              {form.needsInput > 0 && `, ${form.needsInput} need${form.needsInput === 1 ? "s" : ""} your input`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Senior Full Stack Developer at Retail Direct Group", or as much of it as the pages gave. */
export function formTitle({ role, company }: { role: string | null; company: string | null }): string {
  if (role && company) return `${role} at ${company}`;
  return role ?? company ?? "Application form";
}
