import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { StepModels } from "./step-models";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const updateStepModel = vi.fn();
vi.mock("../actions", () => ({ updateStepModel: (input: unknown) => updateStepModel(input) }));

const scoring = { step: "score_listing" as const, provider: "openai" as const, model: "gpt-6-luna", effort: "medium" as const };

test("each step shows its model and effort; Save appears once one is changed, and saves that step", async () => {
  updateStepModel.mockResolvedValue({ ok: true, data: scoring });
  const user = userEvent.setup();
  render(<StepModels stepModels={[scoring]} />);

  expect(screen.getByText("Scoring jobs")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Model for scoring jobs"), "gpt-6.1-sol");
  await user.selectOptions(screen.getByLabelText("Effort for scoring jobs"), "low");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(updateStepModel).toHaveBeenCalledWith({ ...scoring, model: "gpt-6.1-sol", effort: "low" });
});
