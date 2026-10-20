import { AutoRefresh } from "@/components/ui/auto-refresh";
import { formatUsd } from "@/lib/format";
import type { FormView } from "../data";
import { FormQuestions } from "./form-questions";
import { formTitle } from "./recent-forms";

/** One form: the job it is for, where answering stands, and every question with its answer. */
export function FormDetails({ form }: { form: FormView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{formTitle(form)}</h1>
        <section aria-live="polite">
          <Progress form={form} />
        </section>
      </div>

      {form.questions.length > 0 && <FormQuestions questions={form.questions} />}

      <p className="border-t border-rule pt-4 text-sm text-ink-muted">
        Read from {pagesRead(form)}. Cost {formatUsd(form.costUsd)} ({form.modelCalls} model{" "}
        {form.modelCalls === 1 ? "call" : "calls"}). Shortlist never opens or submits the form: you fill it in.
      </p>
    </div>
  );
}

function Progress({ form }: { form: FormView }) {
  const count = (status: string) => form.questions.filter((question) => question.status === status).length;

  if (form.status === "preparing") {
    const waiting = count("pending") + count("checking");
    return (
      <>
        <AutoRefresh />
        <p className="text-lg font-semibold">
          {form.questions.length === 0 ? "Reading the pages…" : `Answering ${waiting} ${waiting === 1 ? "question" : "questions"}…`}
        </p>
        <p className="text-ink-muted">This takes up to a minute. The page updates on its own.</p>
      </>
    );
  }

  if (form.questions.length === 0) {
    return (
      <p className="text-ink-muted">
        No questions were found on these pages. Add screenshots that show the form&apos;s questions below.
      </p>
    );
  }

  const needsInput = count("needs_input");
  const uploads = count("asset_needed");
  const parts = [`${count("answered")} of ${form.questions.length} answered`];
  if (needsInput > 0) parts.push(`${needsInput} ${needsInput === 1 ? "needs" : "need"} your input`);
  if (uploads > 0) parts.push(`${uploads} to upload yourself`);
  return <p className="text-lg font-semibold">{parts.join(", ")}.</p>;
}

/** "3 screenshots", "pasted text", or both. */
function pagesRead(form: FormView): string {
  const parts = [];
  if (form.screenshots > 0) parts.push(`${form.screenshots} ${form.screenshots === 1 ? "screenshot" : "screenshots"}`);
  if (form.hasPastedText) parts.push("pasted text");
  return parts.join(" and ");
}
