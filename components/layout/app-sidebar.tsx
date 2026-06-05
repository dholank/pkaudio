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
    <aside className="flex h-full w-72 flex-col border-r border-[#3c3c3c] bg-[#000] px-4 py-5">
      {/* Brand logo — flat, no gradient */}
      <Link href="/convert" className="group flex items-center gap-3 px-2 py-2">
        <div className="flex size-11 items-center justify-center border border-white bg-black">
          <AudioWaveform className="size-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-title-sm font-bold tracking-normal text-white">
            PKAUDIO
          </div>
          <p className="text-caption text-[#7e7e7e] font-light">Roblox Audio Converter</p>
        </div>
      </Link>

      {/* M stripe divider */}
      <div className="m-stripe mt-4 mb-6" />

      <nav className="space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex h-11 items-center gap-3 px-3 text-sm font-bold uppercase tracking-[1.5px] transition-colors",
                active
                  ? "bg-white text-black"
                  : "text-[#7e7e7e] hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("size-4", active ? "text-black" : "text-[#3c3c3c] group-hover:text-white")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Info strip — flat */}
      <div className="mt-6 border border-[#3c3c3c] p-4">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[1.5px] text-white">
          <Activity className="size-4 text-white" />
          Local Pipeline
        </div>
        <p className="mt-2 text-body-sm text-[#7e7e7e] font-light leading-5">
          SQLite · encrypted credentials · FFmpeg · Roblox upload · moderation.
        </p>
      </div>

      {/* Version footer */}
      <div className="mt-auto border-t border-[#3c3c3c] pt-4">
        <div className="flex items-center justify-between text-caption text-[#7e7e7e]">
          <span>Local system</span>
          <span className="border border-[#0fa336] px-2 py-0.5 text-[#0fa336] text-[11px] uppercase tracking-[1px] font-bold">Live</span>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="block w-1 bg-white/10"
              style={{ height: `${10 + ((i * 7) % 26)}px`, opacity: 0.45 + ((i % 5) * 0.1) }}
            />
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-[#3c3c3c]">v0.1.0</p>
      </div>
    </aside>
  );
}

export { navItems };
