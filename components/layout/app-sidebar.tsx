"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AudioWaveform,
  History,
  KeyRound,
  ListMusic,
  Scissors,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/convert", label: "Convert", icon: AudioWaveform },
  { href: "/auto-cut" as Route, label: "Auto Cut", icon: Scissors },
  { href: "/queue", label: "Queue", icon: ListMusic },
  { href: "/credentials", label: "Credentials", icon: KeyRound },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-72 flex-col border-r border-white/[0.08] bg-[#0b0b0f]/92 px-4 py-5 backdrop-blur-xl">
      <Link href="/convert" className="group flex items-center gap-3 rounded-2xl px-2 py-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow">
          <AudioWaveform className="size-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
            PKAudio <Sparkles className="size-3.5 text-cyan-300" />
          </div>
          <p className="text-xs text-zinc-500">Roblox Audio Converter</p>
        </div>
      </Link>

      <nav className="mt-8 space-y-1.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200",
              )}
            >
              <Icon className={cn("size-4", active ? "text-cyan-300" : "text-zinc-600 group-hover:text-zinc-300")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Activity className="size-4 text-emerald-300" />
          Local-first pipeline
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          SQLite queue, encrypted credentials, FFmpeg conversion, Roblox upload, moderation, backup, and QA doctor.
        </p>
      </div>

      <div className="mt-auto rounded-2xl border border-white/[0.08] bg-[#09090b] p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Local system</span>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">Live</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 waveform-bars" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="mx-auto"
              style={{ height: `${10 + ((i * 7) % 26)}px`, opacity: 0.45 + ((i % 5) * 0.1) }}
            />
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-zinc-600">v0.1.0-local</p>
      </div>
    </aside>
  );
}

export { navItems };
