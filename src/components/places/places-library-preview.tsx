"use client";

import { ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { FoodIcon } from "@/components/icons/food-icons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/ui/star-rating";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { useRestaurantsQuery, type UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/validation/places";

function buildMapsPlaceUrl(item: UserRestaurantItem): string {
  if (item.googleMapsUri) return item.googleMapsUri;
  const params = new URLSearchParams({
    api: "1",
    query: item.name,
    query_place_id: item.googlePlaceId,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function PlacesLibraryPreview({
  initialRestaurants,
}: {
  initialRestaurants: UserRestaurantItem[];
}) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const { data: restaurants = initialRestaurants } = useRestaurantsQuery(initialRestaurants);

  const counts = {
    to_try: 0,
    exploration: 0,
    tried: 0,
  };
  for (const r of restaurants) {
    counts[r.status] += 1;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Places</h1>
        <p className="mt-1 text-sm text-muted">
          Track spots you want to try, low-key explorations, and favourites you&apos;ve visited.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" aria-label="Status overview">
        <Chip tone="to_try">To Try · {counts.to_try}</Chip>
        <Chip tone="exploration">Exploration · {counts.exploration}</Chip>
        <Chip tone="tried">Tried · {counts.tried}</Chip>
      </div>

      {restaurants.length === 0 ? (
        <EmptyState
          title="Nothing on the menu yet"
          description="Paste a Google Maps link or search by name to add your first spot."
          action={
            <Link href="/places?add=1" className={cn(buttonVariants({ variant: "primary" }))}>
              Add first spot
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {restaurants.map((item) => {
            const isHighlighted = highlightId === item.id;
            const priceLabel = formatPriceLevel(item.priceLevel);

            return (
              <Card
                key={item.id}
                className={cn(
                  "transition-colors",
                  isHighlighted && "border-accent ring-2 ring-accent/25",
                )}
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
                    <FoodIcon name={mapCuisinesToFoodIcon(item.cuisines)} className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate font-serif text-lg font-medium text-ink">
                        {item.name}
                      </h2>
                      <Chip tone={item.status} className="min-h-7 shrink-0 px-2.5 py-0.5 text-xs">
                        {STATUS_LABELS[item.status]}
                      </Chip>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {item.cuisines.length > 0 ? <span>{item.cuisines.join(" · ")}</span> : null}
                      {priceLabel ? <span>{priceLabel}</span> : null}
                      {item.city ? <span>{item.city}</span> : null}
                    </div>

                    {item.ratingHalf ? (
                      <div className="mt-2">
                        <StarRating value={item.ratingHalf} readOnly size="sm" label={item.name} />
                      </div>
                    ) : null}

                    {item.notes ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{item.notes}</p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted">
                      <span className="inline-flex min-w-0 items-center gap-1 truncate">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.address ?? "Google Maps place"}</span>
                      </span>
                      <a
                        href={buildMapsPlaceUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 font-medium text-ink hover:bg-surface-elevated"
                      >
                        Maps
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <p className="pt-2 text-center text-xs text-muted">
            Restaurant details pre-filled once with Google Maps.
          </p>
        </div>
      )}
    </div>
  );
}
