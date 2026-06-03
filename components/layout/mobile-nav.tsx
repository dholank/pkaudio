"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/app-sidebar";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#09090b]/90 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400">
          <AudioWaveform className="size-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">PKAudio</p>
          <p className="text-xs text-zinc-500">Local dashboard</p>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                active
                  ? "border-violet-400/30 bg-violet-500/15 text-violet-100"
                  : "border-white/10 bg-white/[0.035] text-zinc-400",
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
