import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RunSettingsForm } from "./run-settings-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateSettings = vi.fn();
vi.mock("../actions", () => ({ updateSettings: (input: unknown) => updateSettings(input) }));

const settings = { dailyTarget: 20, monthlyCapUsd: 50, payFloorUsdMonth: 3000, excludedCountries: ["India"], blockedCompanies: ["micro1"] };

test("shows the saved settings, and saves the edited ones with the countries and companies as lists", async () => {
  updateSettings.mockResolvedValue({ ok: true, data: settings });
  const user = userEvent.setup();
  render(<RunSettingsForm settings={settings} />);

  expect(screen.getByLabelText("Excluded countries")).toHaveValue("India");
  await user.clear(screen.getByLabelText("Jobs on each night's list"));
  await user.type(screen.getByLabelText("Jobs on each night's list"), "12");
  await user.type(screen.getByLabelText("Excluded countries"), ", Nigeria ,");
  expect(screen.getByLabelText("Blocked companies")).toHaveValue("micro1");
  await user.type(screen.getByLabelText("Blocked companies"), ", KDCI");
  await user.click(screen.getByRole("button", { name: "Save settings" }));

  expect(updateSettings).toHaveBeenCalledWith({
    ...settings,
    dailyTarget: 12,
    excludedCountries: ["India", "Nigeria"],
    blockedCompanies: ["micro1", "KDCI"],
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  expect(refresh).toHaveBeenCalled();
});

test("shows why settings were refused", async () => {
  updateSettings.mockResolvedValue({ ok: false, error: { code: "invalid_input", message: "Too big" } });
  render(<RunSettingsForm settings={settings} />);

  await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Too big");
});
