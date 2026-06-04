"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

type TabDef = { id: string; label: string; icon?: string };

const tabs: TabDef[] = [
  { id: "audio", label: "Audio Defaults" },
  { id: "presets", label: "Presets" },
  { id: "worker", label: "Worker & System" },
  { id: "backup", label: "Backup & Storage" },
  { id: "qa", label: "QA Doctor" },
];

export function SettingsTabs({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}

export function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "bg-violet-500/15 text-violet-100"
              : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export { tabs };
