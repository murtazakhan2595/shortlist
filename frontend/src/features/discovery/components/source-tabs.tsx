"use client";

import { type ReactNode, useState } from "react";
import { ToggleGroup } from "@/components/ui/toggle-group";

/** One tab per job source, each showing its own list (owner, 25 October 2026). The first tab is shown first. */
export function SourceTabs({ tabs }: { tabs: { source: string; label: string; content: ReactNode }[] }) {
  const [shown, setShown] = useState(tabs[0]?.source ?? "");
  return (
    <div className="flex flex-col gap-6">
      <ToggleGroup
        legend="Jobs from"
        name="source"
        value={shown}
        options={tabs.map((tab) => ({ value: tab.source, label: tab.label }))}
        onChange={setShown}
      />
      {tabs.find((tab) => tab.source === shown)?.content}
    </div>
  );
}
