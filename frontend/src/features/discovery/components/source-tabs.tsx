"use client";

import { type ReactNode, useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

// A phone has no room for a tab per source, so it gets one picker; wider screens keep the tabs.
export function SourceTabs({ tabs }: { tabs: { source: string; label: string; content: ReactNode }[] }) {
  const [shown, setShown] = useState(tabs[0]?.source ?? "");
  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-2 text-sm font-medium sm:hidden">
        Jobs from
        <select
          value={shown}
          onChange={(event) => setShown(event.target.value)}
          className="h-12 rounded-md border border-rule bg-field px-3 text-base font-normal text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink"
        >
          {tabs.map((tab) => (
            <option key={tab.source} value={tab.source}>
              {tab.label}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden sm:block">
        <ToggleGroup
          legend="Jobs from"
          name="source"
          value={shown}
          options={tabs.map((tab) => ({ value: tab.source, label: tab.label }))}
          onChange={setShown}
        />
      </div>
      {tabs.find((tab) => tab.source === shown)?.content}
    </div>
  );
}
