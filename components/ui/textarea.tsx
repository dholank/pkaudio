import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[140px] w-full border border-[#3c3c3c] bg-[#1a1a1a] px-4 py-3 text-body-md text-white font-light placeholder:text-[#7e7e7e] transition-colors focus-visible:outline-none focus-visible:border-white disabled:cursor-not-allowed disabled:opacity-40 rounded-none",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
