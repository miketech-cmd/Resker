"use client";

import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  ColorScheme,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { BookmarkPlus, Check, ExternalLink, MapPin, Navigation } from "lucide-react";
import { useTheme } from "next-themes";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import type { PublicListRestaurantEntry } from "@/lib/queries/lists";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER = { lat: 40.73061, lng: -73.935242 };

interface MappablePublicSpot extends PublicListRestaurantEntry {
  lat: number;
  lng: number;
}

class PublicMapErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function PublicMapStatusObserver({ onFailure }: { onFailure: () => void }) {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onFailure();
    }
  }, [onFailure, status]);
  return null;
}

function FitPublicBounds({ spots }: { spots: MappablePublicSpot[] }) {
  const map = useMap();

  useEffect(() => {
    const firstSpot = spots[0];
    if (!map || !firstSpot || typeof google === "undefined") return;
    if (spots.length === 1) {
      map.setCenter({ lat: firstSpot.lat, lng: firstSpot.lng });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const spot of spots) {
      bounds.extend({ lat: spot.lat, lng: spot.lng });
    }
    map.fitBounds(bounds, 48);
  }, [map, spots]);

  return null;
}

export function PublicListMap({
  items,
  viewerSignedIn,
  savingSpotId,
  onSaveSpot,
}: {
  items: PublicListRestaurantEntry[];
  viewerSignedIn: boolean;
  savingSpotId: string | null;
  onSaveSpot: (sourceRestaurantId: string, name: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  const mappableSpots = useMemo(
    () =>
      items.filter(
        (item): item is MappablePublicSpot =>
          typeof item.lat === "number" &&
          Number.isFinite(item.lat) &&
          typeof item.lng === "number" &&
          Number.isFinite(item.lng),
      ),
    [items],
  );

  const selectedSpot = useMemo(
    () => mappableSpots.find((spot) => spot.id === selectedId) ?? mappableSpots[0] ?? null,
    [mappableSpots, selectedId],
  );

  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const mapColorScheme = resolvedTheme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT;

  if (mappableSpots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-elevated/40 px-4 py-6 text-center text-sm text-muted">
        No map coordinates are stored for these spots yet. Use the Directions links below.
      </div>
    );
  }

  if (!browserKey || !mapId || mapLoadFailed) {
    return (
      <div className="rounded-2xl border border-border bg-surface-elevated/45 px-4 py-5 text-center text-xs text-muted">
        <MapPin className="mx-auto mb-2 size-5 text-accent" aria-hidden="true" />
        Interactive map preview is unavailable without Google Maps browser configuration. Launch
        Google Maps directions for any spot below.
      </div>
    );
  }

  const priceLabel = selectedSpot ? formatPriceLevel(selectedSpot.priceLevel) : null;

  return (
    <div className="space-y-3" data-testid="public-list-map">
      <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xs sm:h-88 dark:border-[#413830]">
        <PublicMapErrorBoundary
          fallback={
            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted">
              Google Maps preview failed to load. Use the directions list below.
            </div>
          }
        >
          <APIProvider
            apiKey={browserKey}
            libraries={["marker"]}
            onError={() => setMapLoadFailed(true)}
          >
            <PublicMapStatusObserver onFailure={() => setMapLoadFailed(true)} />
            <GoogleMap
              key={mapColorScheme}
              mapId={mapId}
              colorScheme={mapColorScheme}
              defaultCenter={
                mappableSpots[0]
                  ? { lat: mappableSpots[0].lat, lng: mappableSpots[0].lng }
                  : DEFAULT_CENTER
              }
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI
              clickableIcons={false}
              onClick={() => setSelectedId(null)}
              className="h-full w-full"
            >
              <FitPublicBounds spots={mappableSpots} />
              {mappableSpots.map((spot) => {
                const isSelected = selectedSpot?.id === spot.id;
                return (
                  <AdvancedMarker
                    key={spot.id}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    title={spot.name}
                    onClick={() => setSelectedId(spot.id)}
                    zIndex={isSelected ? 20 : 1}
                  >
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full border-2 shadow-md transition-transform",
                        isSelected
                          ? "scale-115 border-white bg-accent text-accent-ink"
                          : "border-white bg-ink text-bg dark:border-[#241e19]",
                      )}
                    >
                      <FoodIcon name={mapCuisinesToFoodIcon(spot.cuisines)} className="size-3.5" />
                    </div>
                  </AdvancedMarker>
                );
              })}
            </GoogleMap>
          </APIProvider>
        </PublicMapErrorBoundary>
      </div>

      {selectedSpot ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-2xs dark:border-[#413830]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-medium text-ink">
              {selectedSpot.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {[selectedSpot.cuisines[0], selectedSpot.city, priceLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewerSignedIn ? (
              selectedSpot.savedByViewer ? (
                <span className="inline-flex h-9 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3.5" aria-hidden="true" />
                  Saved
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={savingSpotId === selectedSpot.id}
                  onClick={() => onSaveSpot(selectedSpot.id, selectedSpot.name)}
                  className="gap-1"
                >
                  <BookmarkPlus className="size-3.5" aria-hidden="true" />
                  {savingSpotId === selectedSpot.id ? "Saving..." : "+ Save"}
                </Button>
              )
            ) : null}

            <a
              href={buildMapsPlaceUrl(selectedSpot)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface-elevated px-3 text-xs font-medium text-ink hover:border-accent/50"
            >
              Maps
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
            <a
              href={buildMapsDirectionsUrl(selectedSpot)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-accent-ink"
            >
              <Navigation className="size-3" aria-hidden="true" />
              Directions
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
