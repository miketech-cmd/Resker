import type { SVGProps } from "react";

export const FOOD_ICON_KEYS = [
  "bowl",
  "noodles",
  "pizza",
  "sushi",
  "taco",
  "burger",
  "croissant",
  "coffee",
  "wine",
  "ice_cream",
  "curry",
  "salad",
] as const;

export type FoodIconKey = (typeof FOOD_ICON_KEYS)[number];

export const FOOD_ICON_LABELS: Record<FoodIconKey, string> = {
  bowl: "Bowl",
  noodles: "Noodles",
  pizza: "Pizza",
  sushi: "Sushi",
  taco: "Taco",
  burger: "Burger",
  croissant: "Bakery",
  coffee: "Coffee",
  wine: "Wine & Bar",
  ice_cream: "Dessert",
  curry: "Curry",
  salad: "Salad",
};

interface FoodIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name?: FoodIconKey | string | null;
}

export function FoodIcon({ name, className = "size-5", ...props }: FoodIconProps) {
  const key: FoodIconKey =
    name && FOOD_ICON_KEYS.includes(name as FoodIconKey) ? (name as FoodIconKey) : "bowl";

  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    ...props,
  };

  switch (key) {
    case "noodles":
      return (
        <svg {...common}>
          <path d="M4 12h16a8 8 0 0 1-16 0Z" />
          <path d="M9 20h6" />
          <path d="M7 12V5M11 12V4M15 12V5" />
          <path d="M5 6l14-2" />
        </svg>
      );
    case "pizza":
      return (
        <svg {...common}>
          <path d="M12 3 4 20c5-1.8 11-1.8 16 0L12 3Z" />
          <path d="M5.5 17c4.2-1.3 8.8-1.3 13 0" />
          <circle cx="11" cy="11" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="14" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sushi":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="10" rx="7" ry="4" />
          <path d="M5 10v4c0 2.2 3.1 4 7 4s7-1.8 7-4v-4" />
          <ellipse cx="12" cy="10" rx="2.5" ry="1.2" />
        </svg>
      );
    case "taco":
      return (
        <svg {...common}>
          <path d="M3 16a9 9 0 0 1 18 0H3Z" />
          <path d="M6.5 13.5c1.5-1 3 0 4.5-1s3 0 4.5 1" />
          <circle cx="9" cy="11" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="14" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "burger":
      return (
        <svg {...common}>
          <path d="M5 10a7 6 0 0 1 14 0H5Z" />
          <path d="M4 13h16" />
          <path d="M5 16h14v1.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V16Z" />
        </svg>
      );
    case "croissant":
      return (
        <svg {...common}>
          <path d="M4.5 15.5c-1.5-2-1-5 1.5-6.5 2.5-1.5 9.5-1.5 12 0 2.5 1.5 3 4.5 1.5 6.5-1.5 1.5-3.5 1-4.5-.5h-6c-1 1.5-3 2-4.5.5Z" />
          <path d="M9.5 8.2 9 15M14.5 8.2l.5 6.8" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common}>
          <path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
          <path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2" />
          <path d="M8 5c0-1 1-1.5 1-2.5M12 5c0-1 1-1.5 1-2.5" />
        </svg>
      );
    case "wine":
      return (
        <svg {...common}>
          <path d="M7 4h10l-1 6a4 4 0 0 1-8 0L7 4Z" />
          <path d="M12 14v6M8.5 20h7" />
          <path d="M8.5 8h7" />
        </svg>
      );
    case "ice_cream":
      return (
        <svg {...common}>
          <path d="M8 10a4 4 0 1 1 8 0" />
          <path d="M7.5 11.5a2 2 0 0 1 2-2h5a2 2 0 0 1 0 4h-5a2 2 0 0 1-2-2Z" />
          <path d="M9 13.5 12 21l3-7.5" />
        </svg>
      );
    case "curry":
      return (
        <svg {...common}>
          <path d="M4 13h16a7 7 0 0 1-14 0" />
          <path d="M8 19h8" />
          <path d="M9 9c0-1.5 1.2-2 1.2-3.5M14 9c0-1.5 1.2-2 1.2-3.5" />
        </svg>
      );
    case "salad":
      return (
        <svg {...common}>
          <path d="M4 12h16a8 8 0 0 1-16 0Z" />
          <path d="M8 12c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" />
          <path d="M6.5 12c-.5-1.5.5-3 2-3.5M17.5 12c.5-1.5-.5-3-2-3.5" />
        </svg>
      );
    case "bowl":
    default:
      return (
        <svg {...common}>
          <path d="M4 12h16a8 8 0 0 1-16 0Z" />
          <path d="M8.5 20h7" />
          <path d="M9 8.5c0-1.2 1-1.8 1-3M14.5 8.5c0-1.2 1-1.8 1-3" />
        </svg>
      );
  }
}
