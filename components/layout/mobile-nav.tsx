"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform, Scissors, ListMusic, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { href: "/convert" as const, label: "Convert", icon: AudioWaveform },
  { href: "/auto-cut" as const, label: "Cut", icon: Scissors },
  { href: "/queue" as const, label: "Queue", icon: ListMusic },
  { href: "/history" as const, label: "History", icon: History },
  { href: "/settings" as const, label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t border-[#3c3c3c] bg-[#000] md:hidden">
      {mobileItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-[1px] transition-colors",
              active ? "bg-white text-black" : "text-[#7e7e7e] hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
