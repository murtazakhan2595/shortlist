"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MODEL_PRICES, type ModelStep, REASONING_EFFORTS } from "@/lib/model-catalog";
import { updateStepModel } from "../actions";
import type { UpdateStepModelInput } from "../schemas";

const STEP_LABELS: Record<ModelStep, string> = {
  extract_capture: "Reading captured posts",
  write_email: "Writing emails",
  check_email: "Checking emails",
  read_form: "Reading forms",
  answer_form: "Answering forms",
  check_form_answers: "Checking form answers",
  score_listing: "Scoring jobs",
};

const SELECT =
  "h-10 rounded-md border border-rule bg-field px-2 text-base text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-60";

export function StepModels({ stepModels }: { stepModels: UpdateStepModelInput[] }) {
  return (
    <ul className="flex flex-col">
      {stepModels.map((stepModel) => (
        <StepModelRow key={stepModel.step} saved={stepModel} />
      ))}
    </ul>
  );
}

function StepModelRow({ saved }: { saved: UpdateStepModelInput }) {
  const router = useRouter();
  const [choice, setChoice] = useState(saved);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const changed = choice.model !== saved.model || choice.effort !== saved.effort;
  const label = STEP_LABELS[saved.step];

  function saveChoice() {
    setError(undefined);
    startTransition(async () => {
      const result = await updateStepModel(choice);
      if (!result.ok) return setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 border-t border-rule py-3 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex-1 font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Model for ${label.toLowerCase()}`}
          value={choice.model}
          disabled={isPending}
          onChange={(event) => setChoice({ ...choice, model: event.target.value })}
          className={SELECT}
        >
          {Object.keys(MODEL_PRICES[choice.provider]).map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <select
          aria-label={`Effort for ${label.toLowerCase()}`}
          value={choice.effort}
          disabled={isPending}
          onChange={(event) => setChoice({ ...choice, effort: REASONING_EFFORTS.find((effort) => effort === event.target.value) ?? choice.effort })}
          className={SELECT}
        >
          {REASONING_EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {effort} effort
            </option>
          ))}
        </select>
        {changed && (
          <button
            type="button"
            onClick={saveChoice}
            disabled={isPending}
            className="h-10 cursor-pointer rounded-md bg-ink px-4 text-sm font-semibold text-paper outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {error}
        </p>
      )}
    </li>
  );
}
