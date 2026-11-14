import type { ReactNode } from "react";

import { EmptyPlateIllustration } from "@/components/icons/empty-plate";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      <EmptyPlateIllustration className="mb-4 size-24 text-muted" />
      <h2 className="font-serif text-xl font-medium text-ink">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
