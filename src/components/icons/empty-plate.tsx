import type { SVGProps } from "react";

export function EmptyPlateIllustration({
  className = "size-28",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Outer & inner plate */}
      <circle cx="60" cy="60" r="34" className="opacity-80" />
      <circle cx="60" cy="60" r="22" className="opacity-35" />
      {/* Fork on left */}
      <path d="M16 32v14c0 3 2.5 5 5 5v37" />
      <path d="M21 32v13M26 32v14c0 3-2.5 5-5 5" />
      {/* Knife on right */}
      <path d="M101 88V58h-3c0-12 2-22 6-26v56" />
    </svg>
  );
}
