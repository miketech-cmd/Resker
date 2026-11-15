"use client";

import { ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FoodIcon } from "@/components/icons/food-icons";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StarRating } from "@/components/ui/star-rating";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { normalizeFacetKey, type FacetId } from "@/lib/places/facets";
import { buildMapsPlaceUrl } from "@/lib/places/maps-links";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/validation/places";

export function PlaceCard({
  item,
  highlighted = false,
  onQuickFilter,
}: {
  item: UserRestaurantItem;
  highlighted?: boolean;
  onQuickFilter?: (facetId: FacetId, key: string) => void;
}) {
  const router = useRouter();
  const priceLabel = formatPriceLevel(item.priceLevel);
  const detailHref = `/places/${item.id}`;
  const visibleCuisines = item.cuisines.filter((c) => c.trim().toLowerCase() !== "restaurant");

  return (
    <Card
      className={cn(
        "transition-colors hover:border-border/90",
        highlighted && "border-accent ring-2 ring-accent/25",
      )}
    >
      <div className="flex items-start gap-3.5">
        <Link
          href={detailHref}
          onPointerEnter={() => router.prefetch(detailHref)}
          aria-label={`Open ${item.name}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <FoodIcon name={mapCuisinesToFoodIcon(item.cuisines)} className="size-5" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={detailHref}
              onPointerEnter={() => router.prefetch(detailHref)}
              className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <h2 className="truncate font-serif text-lg font-medium text-ink hover:text-accent">
                {item.name}
              </h2>
            </Link>
            <Chip tone={item.status} className="min-h-7 shrink-0 px-2.5 py-0.5 text-xs">
              {STATUS_LABELS[item.status]}
            </Chip>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {item.city ? (
              onQuickFilter ? (
                <button
                  type="button"
                  onClick={() => onQuickFilter("city", normalizeFacetKey(item.city ?? ""))}
                  className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border border-border bg-surface-elevated/70 px-2.5 py-0.5 font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-ring"
                  title={`Filter by ${item.city}`}
                >
                  <MapPin className="size-3 text-muted" aria-hidden="true" />
                  {item.city}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-ink">
                  <MapPin className="size-3 text-muted" aria-hidden="true" />
                  {item.city}
                </span>
              )
            ) : null}

            {visibleCuisines.slice(0, 3).map((tag) =>
              onQuickFilter ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onQuickFilter("cuisine", normalizeFacetKey(tag))}
                  className="inline-flex min-h-7 cursor-pointer items-center rounded-full border border-border/80 bg-surface px-2.5 py-0.5 font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                  title={`Filter by ${tag}`}
                >
                  {tag}
                </button>
              ) : (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-border/80 px-2 py-0.5"
                >
                  {tag}
                </span>
              ),
            )}

            {priceLabel ? <span className="px-1 font-medium text-ink">{priceLabel}</span> : null}
          </div>

          {item.ratingHalf || item.visitCount > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {item.ratingHalf ? (
                <StarRating value={item.ratingHalf} readOnly size="sm" label={item.name} />
              ) : null}
              {item.visitCount > 0 ? (
                <span className="text-xs text-muted">
                  {item.visitCount} {item.visitCount === 1 ? "visit" : "visits"}
                </span>
              ) : null}
            </div>
          ) : null}

          {item.notes ? <p className="mt-2 line-clamp-2 text-sm text-muted">{item.notes}</p> : null}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted">
            <Link
              href={detailHref}
              onPointerEnter={() => router.prefetch(detailHref)}
              className="min-w-0 flex-1 truncate hover:text-ink"
            >
              {item.address ?? "View spot details"}
            </Link>
            <a
              href={buildMapsPlaceUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Maps
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
