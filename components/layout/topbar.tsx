"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Server } from "lucide-react";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/convert": {
    title: "Convert Audio",
    description: "Download, speed-shift, amplify, encode OGG, and upload Roblox assets in one batch.",
  },
  "/queue": {
    title: "Queue",
    description: "Monitor active downloads, conversions, uploads, logs, and retries.",
  },
  "/credentials": {
    title: "Credentials",
    description: "Store Roblox Open Cloud API keys encrypted in local SQLite.",
  },
  "/history": {
    title: "History",
    description: "Browse previous conversions, output files, and uploaded Roblox asset IDs.",
  },
  "/settings": {
    title: "Settings",
    description: "Configure audio defaults, storage cleanup, and local system checks.",
  },
};

export function Topbar() {
  const pathname = usePathname();
  const meta = pageMeta[pathname] ?? pageMeta["/convert"];

  return (
    <header className="relative overflow-hidden border-b border-white/[0.08] bg-[#09090b]/72 px-5 py-5 backdrop-blur-xl sm:px-8">
      <div className="audio-grid-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{meta.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">{meta.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" className="gap-1.5">
            <Database className="size-3" /> SQLite OK
          </Badge>
          <Badge variant="cyan" className="gap-1.5">
            <Server className="size-3" /> Queue DB OK
          </Badge>
          <Badge variant="warning" className="gap-1.5">
            <Activity className="size-3" /> Worker pending
          </Badge>
        </div>
      </div>
    </header>
  );
}
