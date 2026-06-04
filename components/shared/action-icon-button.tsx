"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ActionIconButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "danger";
  tooltipSide?: "top" | "bottom" | "left" | "right";
};

/**
 * Shared icon button with tooltip.
 * Usage:
 *   <ActionIconButton icon={Terminal} label="Logs" onClick={handleLogs} />
 *   <ActionIconButton icon={Download} label="Download OGG" href="/api/outputs/..." />
 *   <ActionIconButton icon={Trash2} label="Delete" tone="danger" onClick={handleDelete} />
 *
 * Requires a parent <TooltipProvider> in the tree.
 */
export function ActionIconButton({
  icon: Icon,
  label,
  onClick,
  href,
  disabled = false,
  tone = "default",
  tooltipSide = "top",
}: ActionIconButtonProps) {
  const isDanger = tone === "danger";

  const sharedProps = {
    variant: "outline" as const,
    size: "sm" as const,
    className: [
      "h-8 w-8 p-0 sm:w-auto sm:px-2.5",
      isDanger
        ? "border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10"
        : "",
      disabled ? "pointer-events-none opacity-50" : "",
    ].filter(Boolean).join(" "),
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button {...sharedProps} asChild>
            <a href={href} aria-label={label}>
              <Icon className="size-4" />
            </a>
          </Button>
        ) : (
          <Button
            {...sharedProps}
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
          >
            <Icon className="size-4" />
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="text-xs">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
