import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors select-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-ink",
        accent: "border-accent bg-accent text-accent-ink",
        to_try: "border-transparent bg-to-try-bg text-to-try-ink",
        exploration: "border-transparent bg-exploration-bg text-exploration-ink",
        tried: "border-transparent bg-tried-bg text-tried-ink",
      },
      interactive: {
        true: "cursor-pointer hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        false: "",
      },
    },
    defaultVariants: {
      tone: "neutral",
      interactive: false,
    },
  },
);

export interface ChipProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof chipVariants> {
  selected?: boolean;
}

export function Chip({
  className,
  tone,
  interactive = false,
  selected,
  type = "button",
  ...props
}: ChipProps) {
  const resolvedTone = selected ? "accent" : tone;
  return (
    <button
      type={type}
      aria-pressed={interactive ? Boolean(selected) : undefined}
      className={cn(chipVariants({ tone: resolvedTone, interactive }), className)}
      {...props}
    />
  );
}
