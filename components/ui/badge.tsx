import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-violet-500/18 text-violet-200",
        secondary: "border-white/10 bg-white/[0.06] text-zinc-300",
        destructive: "border-rose-500/20 bg-rose-500/15 text-rose-200",
        outline: "border-white/10 text-zinc-300",
        success: "border-emerald-500/20 bg-emerald-500/15 text-emerald-200",
        warning: "border-amber-500/20 bg-amber-500/15 text-amber-200",
        cyan: "border-cyan-500/20 bg-cyan-500/15 text-cyan-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
