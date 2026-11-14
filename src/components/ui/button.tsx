import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:opacity-92 shadow-xs",
        secondary: "bg-surface-elevated text-ink hover:bg-border/60",
        outline: "border border-border bg-surface text-ink hover:bg-surface-elevated",
        ghost: "text-ink hover:bg-surface-elevated",
        destructive: "bg-danger text-white hover:opacity-92",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "min-h-11 px-5 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
