"use client";

import { useId, type KeyboardEvent, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** Rating stored as half-steps: 1..10 (e.g. 7 = 3.5 stars), or null for unrated. */
  value: number | null;
  onChange?: (next: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

export function formatStars(ratingHalf: number | null): string {
  if (!ratingHalf) return "Unrated";
  const stars = ratingHalf / 2;
  return `${Number.isInteger(stars) ? stars : stars.toFixed(1)} of 5 stars`;
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  label = "Rating",
  className,
}: StarRatingProps) {
  const uid = useId();
  const current = value ?? 0;

  function handleStarClick(starIndex: number, event: MouseEvent<HTMLButtonElement>) {
    if (readOnly || !onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    const nextHalf = isLeftHalf ? starIndex * 2 - 1 : starIndex * 2;
    onChange(nextHalf === current ? null : nextHalf);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readOnly || !onChange) return;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(10, current + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = current - 1;
      onChange(next <= 0 ? null : next);
    } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      onChange(null);
    }
  }

  return (
    <div
      role={readOnly ? "img" : "slider"}
      aria-label={`${label}: ${formatStars(value)}`}
      aria-valuemin={readOnly ? undefined : 0}
      aria-valuemax={readOnly ? undefined : 5}
      aria-valuenow={readOnly ? undefined : current / 2}
      aria-valuetext={readOnly ? undefined : formatStars(value)}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = current >= star * 2 ? 100 : current === star * 2 - 1 ? 50 : 0;
        const clipId = `${uid}-star-${star}`;

        const svg = (
          <svg viewBox="0 0 24 24" className={cn(SIZE_MAP[size], "shrink-0")} aria-hidden="true">
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={`${fillPercent}%`} height="24" />
              </clipPath>
            </defs>
            <path
              d="M12 2.5 14.9 8.4l6.5.95-4.7 4.58 1.11 6.47L12 17.35 6.19 20.4l1.11-6.47L2.6 9.35l6.5-.95L12 2.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              className="text-muted/50"
            />
            {fillPercent > 0 && (
              <path
                d="M12 2.5 14.9 8.4l6.5.95-4.7 4.58 1.11 6.47L12 17.35 6.19 20.4l1.11-6.47L2.6 9.35l6.5-.95L12 2.5Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
                clipPath={`url(#${clipId})`}
                className="text-to-try"
              />
            )}
          </svg>
        );

        if (readOnly) {
          return <span key={star}>{svg}</span>;
        }

        return (
          <button
            key={star}
            type="button"
            tabIndex={-1}
            onClick={(e) => handleStarClick(star, e)}
            aria-label={`Set ${star} stars`}
            className="flex min-h-11 min-w-8 cursor-pointer items-center justify-center rounded-md transition-transform active:scale-90"
          >
            {svg}
          </button>
        );
      })}
    </div>
  );
}
