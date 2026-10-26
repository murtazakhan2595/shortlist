import { CopyButton } from "@/components/ui/copy-button";
import type { FormQuestion } from "../data";
import { OwnerAnswerForm } from "./owner-answer-form";

export function FormQuestions({ questions }: { questions: FormQuestion[] }) {
  return (
    <ol className="flex flex-col">
      {questions.map((question) => (
        <li key={question.id} className="grid grid-cols-[2rem_1fr] gap-x-2 border-t border-rule py-5">
          <span aria-hidden className="pt-0.5 text-sm font-semibold text-ink-muted tabular-nums">
            {question.position}.
          </span>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="font-medium">{question.question}</p>
            {question.options.length > 0 && (
              <p className="text-sm text-ink-muted">Choices: {question.options.join(", ")}</p>
            )}
            <Answer question={question} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Answer({ question }: { question: FormQuestion }) {
  const { status, answer, note } = question;

  if (status === "pending") return <p className="text-sm text-ink-muted">Answering…</p>;
  if (status === "checking") return <p className="text-sm text-ink-muted">Checking the answer against your profile…</p>;

  if (status === "needs_input") {
    return (
      <div className="flex flex-col gap-3 rounded-md border-2 border-dashed border-ink-muted p-3">
        <p className="text-sm">
          <span className="font-semibold">Needs your input.</span> {note}
          {answer && " Check the draft below and replace anything in [brackets]."}
        </p>
        <OwnerAnswerForm formAnswerId={question.id} initialAnswer={answer ?? ""} />
      </div>
    );
  }

  if (status === "asset_needed") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <span className="font-semibold">Upload this yourself.</span> {note}
        </p>
        {answer && <p className="rounded-md border border-rule bg-field p-3">{answer}</p>}
        <ChangeAnswer question={question} label="Answer with a link or text instead" />
      </div>
    );
  }

  // Answered: a choice is picked on the form, so it gets no copy button.
  const isChoice = question.options.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3 rounded-md border border-rule bg-field p-3">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">
          {isChoice && <span className="text-ink-muted">Pick: </span>}
          {answer}
        </p>
        {!isChoice && answer && <CopyButton text={answer} />}
      </div>
      <ChangeAnswer question={question} label="Change this answer" />
    </div>
  );
}

function ChangeAnswer({ question, label }: { question: FormQuestion; label: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-muted hover:text-ink">{label}</summary>
      <div className="pt-3">
        <OwnerAnswerForm formAnswerId={question.id} initialAnswer={question.answer ?? ""} />
      </div>
    </details>
  );
}
