"use client";

import { ExternalLink, MapPin, Navigation, X } from "lucide-react";
import Link from "next/link";

import { FoodIcon } from "@/components/icons/food-icons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StarRating } from "@/components/ui/star-rating";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/validation/places";

export function MapPeekCard({
  restaurant,
  onClose,
}: {
  restaurant: UserRestaurantItem;
  onClose: () => void;
}) {
  const priceLabel = formatPriceLevel(restaurant.priceLevel);
  const visibleCuisines = restaurant.cuisines.filter(
    (c) => c.trim().toLowerCase() !== "restaurant",
  );

  return (
    <Card
      role="region"
      aria-label={`Selected spot: ${restaurant.name}`}
      className="pointer-events-auto space-y-3 border-border/90 bg-surface/96 shadow-lg backdrop-blur-md dark:border-[#413830] dark:bg-surface/96"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
          <FoodIcon name={mapCuisinesToFoodIcon(restaurant.cuisines)} className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/places/${restaurant.id}`}
              className="min-w-0 flex-1 truncate font-serif text-lg font-medium text-ink hover:text-accent"
            >
              {restaurant.name}
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <Chip tone={restaurant.status} className="min-h-7 px-2.5 py-0.5 text-xs">
                {STATUS_LABELS[restaurant.status]}
              </Chip>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close selected spot"
                className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {restaurant.city ? (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <MapPin className="size-3 text-accent" aria-hidden="true" />
                {restaurant.city}
              </span>
            ) : null}
            {visibleCuisines.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border/80 bg-surface-elevated/55 px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
            {priceLabel ? <span className="font-medium text-ink">{priceLabel}</span> : null}
            {restaurant.ratingHalf ? (
              <StarRating
                value={restaurant.ratingHalf}
                readOnly
                size="sm"
                label={restaurant.name}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/places/${restaurant.id}`}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-10")}
        >
          Details
        </Link>
        <a
          href={buildMapsPlaceUrl(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-10 gap-1")}
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Maps
        </a>
        <a
          href={buildMapsDirectionsUrl(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-10 gap-1")}
        >
          <Navigation className="size-3.5" aria-hidden="true" />
          Directions
        </a>
      </div>
    </Card>
  );
}
