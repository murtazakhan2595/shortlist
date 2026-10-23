"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettings } from "../actions";
import type { UpdateSettingsInput } from "../schemas";

/** "India, Nigeria " as ["India", "Nigeria"]. */
function commaList(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * The nightly run's settings (U4): how many jobs a night, the monthly cap, the lowest pay, excluded countries
 * and blocked companies.
 */
export function RunSettingsForm({ settings }: { settings: UpdateSettingsInput }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateSettings({
        dailyTarget: Number(form.get("dailyTarget")),
        monthlyCapUsd: Number(form.get("monthlyCapUsd")),
        payFloorUsdMonth: Number(form.get("payFloorUsdMonth")),
        excludedCountries: commaList(String(form.get("excludedCountries"))),
        blockedCompanies: commaList(String(form.get("blockedCompanies"))),
      });
      if (!result.ok) return setMessage({ ok: false, text: result.error.message });
      setMessage({ ok: true, text: "Saved. The next nightly run uses these." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setMessage(undefined)} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="dailyTarget" label="Jobs on each night's list" hint="Each gets a note to paste.">
          <Input id="dailyTarget" name="dailyTarget" aria-describedby="dailyTarget-hint" type="number" required min={1} max={100} step={1} defaultValue={settings.dailyTarget} />
        </Field>
        <Field id="monthlyCapUsd" label="Monthly spending cap, US dollars" hint="The nightly run stops when it is reached.">
          <Input
            id="monthlyCapUsd"
            name="monthlyCapUsd"
            aria-describedby="monthlyCapUsd-hint"
            type="number"
            required
            min={0}
            max={1000}
            step={0.01}
            defaultValue={settings.monthlyCapUsd}
          />
        </Field>
        <Field id="payFloorUsdMonth" label="Lowest pay, US dollars a month" hint="Jobs that state less are dropped.">
          <Input id="payFloorUsdMonth" name="payFloorUsdMonth" aria-describedby="payFloorUsdMonth-hint" type="number" required min={0} step={1} defaultValue={settings.payFloorUsdMonth} />
        </Field>
        <Field id="excludedCountries" label="Excluded countries" hint="Separated by commas, as Himalayas names them.">
          <Input id="excludedCountries" name="excludedCountries" aria-describedby="excludedCountries-hint" defaultValue={settings.excludedCountries.join(", ")} />
        </Field>
        <Field id="blockedCompanies" label="Blocked companies" hint="Separated by commas. Their jobs are dropped before scoring.">
          <Input id="blockedCompanies" name="blockedCompanies" aria-describedby="blockedCompanies-hint" defaultValue={settings.blockedCompanies.join(", ")} />
        </Field>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={isPending} className="sm:w-auto sm:self-start">
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p id={`${id}-hint`} className="text-sm text-ink-muted">
        {hint}
      </p>
    </div>
  );
}
