import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-caption font-medium transition-colors rounded-none",
  {
    variants: {
      variant: {
        default: "border-white/20 text-white bg-transparent",
        secondary: "border-[#3c3c3c] text-[#bbbbbb] bg-[#1a1a1a]",
        destructive: "border-[#e22718] text-[#e22718] bg-transparent",
        outline: "border-[#3c3c3c] text-white bg-transparent",
        success: "border-[#0fa336] text-[#0fa336] bg-transparent",
        warning: "border-[#f4b400] text-[#f4b400] bg-transparent",
        cyan: "border-[#1c69d4] text-[#1c69d4] bg-transparent",
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
