import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-bold uppercase tracking-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black border border-white hover:bg-transparent hover:text-white",
        destructive:
          "border border-[#e22718] text-[#e22718] hover:bg-[#e22718] hover:text-white",
        outline:
          "border border-[#3c3c3c] text-white hover:bg-white/10 hover:border-white/30",
        secondary:
          "bg-[#1a1a1a] text-white border border-[#3c3c3c] hover:bg-[#262626]",
        ghost:
          "border border-transparent text-white/60 hover:text-white hover:bg-white/5",
        link:
          "text-white underline-offset-4 hover:underline uppercase tracking-[1.5px]",
      },
      size: {
        default: "h-12 px-8",
        sm: "h-9 px-4 text-xs tracking-[1px]",
        lg: "h-14 px-10 text-base",
        icon: "h-12 w-12 rounded-full border border-[#3c3c3c] bg-[#1a1a1a] hover:bg-[#262626]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
