"use client";

import { BookmarkPlus, ExternalLink, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FoodIcon } from "@/components/icons/food-icons";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StarRating } from "@/components/ui/star-rating";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import type { PlacesDensity } from "@/lib/places/density-store";
import { normalizeFacetKey, type FacetId } from "@/lib/places/facets";
import { buildMapsPlaceUrl } from "@/lib/places/maps-links";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/validation/places";

export function PlaceCard({
  item,
  highlighted = false,
  density = "comfortable",
  onQuickFilter,
  onOpenLists,
}: {
  item: UserRestaurantItem;
  highlighted?: boolean;
  density?: PlacesDensity;
  onQuickFilter?: (facetId: FacetId, key: string) => void;
  onOpenLists?: (item: UserRestaurantItem) => void;
}) {
  const router = useRouter();
  const priceLabel = formatPriceLevel(item.priceLevel);
  const detailHref = `/places/${item.id}`;
  const visibleCuisines = item.cuisines.filter((c) => c.trim().toLowerCase() !== "restaurant");

  if (density === "compact") {
    const primaryCuisine = visibleCuisines[0] ?? null;
    const ratingValue = item.ratingHalf ? (item.ratingHalf / 2).toFixed(1) : null;

    return (
      <Card
        data-density="compact"
        className={cn(
          "px-3 py-2.5 transition-colors hover:border-border/90 dark:border-[#413830] dark:hover:border-[#564a40]",
          highlighted && "border-accent ring-2 ring-accent/25 dark:border-accent",
        )}
      >
        <div className="flex items-center gap-2.5">
          <Link
            href={detailHref}
            onPointerEnter={() => router.prefetch(detailHref)}
            aria-label={`Open ${item.name}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-accent transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <FoodIcon name={mapCuisinesToFoodIcon(item.cuisines)} className="size-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={detailHref}
                onPointerEnter={() => router.prefetch(detailHref)}
                className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
              >
                <h2 className="truncate font-serif text-base leading-snug font-medium text-ink hover:text-accent">
                  {item.name}
                </h2>
              </Link>
              <Chip
                tone={item.status}
                className="min-h-6 shrink-0 px-2 py-0.5 text-[11px] leading-none"
              >
                {STATUS_LABELS[item.status]}
              </Chip>
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
              {item.city ? (
                <span className="truncate font-medium text-ink">{item.city}</span>
              ) : null}
              {item.city && (primaryCuisine || priceLabel || ratingValue) ? (
                <span aria-hidden="true">·</span>
              ) : null}
              {primaryCuisine ? <span className="truncate">{primaryCuisine}</span> : null}
              {primaryCuisine && (priceLabel || ratingValue) ? (
                <span aria-hidden="true">·</span>
              ) : null}
              {priceLabel ? (
                <span className="shrink-0 font-medium text-ink">{priceLabel}</span>
              ) : null}
              {priceLabel && ratingValue ? <span aria-hidden="true">·</span> : null}
              {ratingValue ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-ink tabular-nums">
                  <Star className="size-3 fill-accent text-accent" aria-hidden="true" />
                  {ratingValue}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {onOpenLists ? (
              <button
                type="button"
                onClick={() => onOpenLists(item)}
                aria-label={`Add ${item.name} to lists`}
                title="Add to lists"
                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
              >
                <BookmarkPlus className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <a
              href={buildMapsPlaceUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.name} in Google Maps`}
              title="Open in Google Maps"
              className="inline-flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-density="comfortable"
      className={cn(
        "transition-colors hover:border-border/90 dark:border-[#413830] dark:hover:border-[#564a40]",
        highlighted && "border-accent ring-2 ring-accent/25 dark:border-accent",
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
                  className="inline-flex min-h-7 cursor-pointer items-center rounded-full border border-border/80 bg-surface px-2.5 py-0.5 font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring dark:bg-surface-elevated/60"
                  title={`Filter by ${tag}`}
                >
                  {tag}
                </button>
              ) : (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-border/80 px-2 py-0.5 dark:bg-surface-elevated/60"
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
            <div className="flex shrink-0 items-center gap-1">
              {onOpenLists ? (
                <button
                  type="button"
                  onClick={() => onOpenLists(item)}
                  aria-label={`Add ${item.name} to lists`}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2 font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <BookmarkPlus className="size-3.5" aria-hidden="true" />
                  Lists
                </button>
              ) : null}
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
      </div>
    </Card>
  );
}
