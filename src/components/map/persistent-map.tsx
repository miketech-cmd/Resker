"use client";

import {
  APILoadingStatus,
  APIProvider,
  ColorScheme,
  Map as GoogleMap,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { Crosshair, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Component,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ClusteredMarkers, type MappableRestaurant } from "@/components/map/clustered-markers";
import { MapPeekCard } from "@/components/map/map-peek-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  extractFacetOptions,
  filterAndSortRestaurants,
  type LibraryFilters,
} from "@/lib/places/facets";
import {
  clearAllLibraryFilters,
  countActiveSheetFilters,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
  setSingleFacetValue,
} from "@/lib/places/filter-state";
import { setSharedFilters } from "@/lib/places/filter-store";
import { usePendingDeleteIds } from "@/lib/places/pending-delete";
import { useListDetailQuery, useListsQuery } from "@/lib/queries/lists";
import { useRestaurantsQuery } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { RESTAURANT_STATUSES, STATUS_LABELS, type RestaurantStatus } from "@/lib/validation/places";

const DynamicFilterSheet = dynamic(
  () => import("@/components/places/filter-sheet").then((mod) => mod.FilterSheet),
  { ssr: false },
);

const DEFAULT_CENTER = { lat: 40.73061, lng: -73.935242 }; // NYC fallback until pins load

interface MapErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function MapApiStatusObserver({ onFailure }: { onFailure: () => void }) {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onFailure();
    }
  }, [onFailure, status]);

  return null;
}

function MapFallbackCard({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <MapPin className="mx-auto size-7 text-accent" aria-hidden="true" />
        <h2 className="mt-3 font-serif text-lg font-medium text-ink">{title}</h2>
        <p className="mt-1.5 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

const AUTH_FAILED_FALLBACK = (
  <MapFallbackCard
    title="Google Maps unavailable here"
    body="Check your browser key referrer restrictions or network connection. You can still filter spots above or view them in Places."
  />
);

const CONFIG_MISSING_FALLBACK = (
  <MapFallbackCard
    title="Google Maps configuration required"
    body={
      <>
        Set <code className="text-ink">NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> and{" "}
        <code className="text-ink">NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID</code> to display your map.
      </>
    }
  />
);

export function PersistentMap({ isActive }: { isActive: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();

  const { data: rawRestaurants = [] } = useRestaurantsQuery();
  const pendingDeleteIds = usePendingDeleteIds();
  const restaurants = useMemo(
    () =>
      pendingDeleteIds.size === 0
        ? rawRestaurants
        : rawRestaurants.filter((item) => !pendingDeleteIds.has(item.id)),
    [pendingDeleteIds, rawRestaurants],
  );
  const { data: lists } = useListsQuery(undefined, isActive);
  const rawListParam = isActive ? searchParams.get("list") : null;
  const listId = rawListParam && !rawListParam.includes(",") ? rawListParam : null;
  const listDetailQuery = useListDetailQuery(listId ?? "");

  const isFilterOpen = isActive && searchParams.get("filter") === "1";

  const filters = useMemo(() => {
    if (!isActive) return parseFiltersFromSearchParams(new URLSearchParams());
    return parseFiltersFromSearchParams(searchParams);
  }, [isActive, searchParams]);

  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  useEffect(() => {
    const win = window as unknown as { gm_authFailure?: () => void };
    const previousHandler = win.gm_authFailure;
    win.gm_authFailure = () => {
      setMapLoadFailed(true);
      previousHandler?.();
    };
    return () => {
      win.gm_authFailure = previousHandler;
    };
  }, []);

  const effectiveQuery = searchDraft ?? filters.q;
  const deferredQuery = useDeferredValue(effectiveQuery);

  const effectiveFilters = useMemo<LibraryFilters>(
    () => ({
      ...filters,
      q: deferredQuery,
    }),
    [deferredQuery, filters],
  );

  // Keep shared store updated whenever /map filters change.
  useEffect(() => {
    if (isActive) {
      setSharedFilters(filters);
    }
  }, [filters, isActive]);

  const updateMapUrlFilters = useCallback(
    (next: LibraryFilters, extra?: { openFilter?: boolean; listId?: string | null }) => {
      setSharedFilters(next);
      const baseParams = new URLSearchParams(searchParams.toString());
      const serialized = serializeFiltersToSearchParams(next, baseParams);

      if (extra?.openFilter === true) {
        serialized.set("filter", "1");
      } else if (extra?.openFilter === false) {
        serialized.delete("filter");
        serialized.delete("section");
      }

      if (extra?.listId === null) {
        serialized.delete("list");
      } else if (extra?.listId) {
        serialized.set("list", extra.listId);
      }

      const qs = serialized.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function closeFilterSheet() {
    if (!searchParams.has("filter") && !searchParams.has("section")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("filter");
    next.delete("section");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const scopedRestaurants = useMemo(() => {
    if (!listId || !listDetailQuery.data) {
      return restaurants;
    }
    const allowedIds = new Set(listDetailQuery.data.items.map((item) => item.id));
    return restaurants.filter((item) => allowedIds.has(item.id));
  }, [listDetailQuery.data, listId, restaurants]);

  const filteredSpots = useMemo(
    () =>
      filterAndSortRestaurants(scopedRestaurants, effectiveFilters, {
        lists: listId && listDetailQuery.data ? undefined : lists,
      }),
    [effectiveFilters, listDetailQuery.data, listId, lists, scopedRestaurants],
  );

  const mappableSpots = useMemo<MappableRestaurant[]>(
    () =>
      filteredSpots.filter(
        (spot): spot is MappableRestaurant =>
          typeof spot.lat === "number" &&
          Number.isFinite(spot.lat) &&
          typeof spot.lng === "number" &&
          Number.isFinite(spot.lng),
      ),
    [filteredSpots],
  );

  const missingCoordsCount = filteredSpots.length - mappableSpots.length;
  const selectedSpot = useMemo(
    () => (selectedId ? (filteredSpots.find((spot) => spot.id === selectedId) ?? null) : null),
    [filteredSpots, selectedId],
  );

  const selectedStatuses = filters.facets.status ?? [];
  const activeSheetFiltersCount = countActiveSheetFilters(filters);

  function handleStatusPillClick(status: RestaurantStatus | "all") {
    if (status === "all") {
      updateMapUrlFilters(setSingleFacetValue(filters, "status", null));
      return;
    }
    if (selectedStatuses.length === 1 && selectedStatuses[0] === status) {
      updateMapUrlFilters(setSingleFacetValue(filters, "status", null));
    } else {
      updateMapUrlFilters(setSingleFacetValue(filters, "status", status));
    }
  }

  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const mapColorScheme = resolvedTheme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT;

  const selectedCityLabels = useMemo(() => {
    const cityKeys = filters.facets.city ?? [];
    if (cityKeys.length === 0) return [];
    const labelByKey = new Map(
      extractFacetOptions(scopedRestaurants, "city").map((opt) => [opt.key, opt.label]),
    );
    return cityKeys.map((key) => labelByKey.get(key) ?? key).slice(0, 2);
  }, [filters.facets.city, scopedRestaurants]);

  return (
    <div
      aria-hidden={!isActive}
      className={cn(
        "fixed top-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-20 lg:bottom-0 lg:left-64",
        isActive
          ? "visible opacity-100 pointer-events-auto"
          : "invisible opacity-0 pointer-events-none",
      )}
    >
      {/* Interactive Google Map Canvas */}
      <div className="relative h-full w-full bg-bg">
        {browserKey && mapId && !mapLoadFailed ? (
          <MapErrorBoundary fallback={AUTH_FAILED_FALLBACK}>
            <APIProvider
              apiKey={browserKey}
              libraries={["marker"]}
              onError={() => setMapLoadFailed(true)}
            >
              <MapApiStatusObserver onFailure={() => setMapLoadFailed(true)} />
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
                <ClusteredMarkers
                  items={mappableSpots}
                  selectedId={selectedSpot?.id ?? null}
                  onSelect={setSelectedId}
                  fitTrigger={fitTrigger}
                />
              </GoogleMap>
            </APIProvider>
          </MapErrorBoundary>
        ) : mapLoadFailed ? (
          AUTH_FAILED_FALLBACK
        ) : (
          CONFIG_MISSING_FALLBACK
        )}

        {/* Top Floating Filter Bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 sm:p-4">
          <div className="mx-auto max-w-2xl space-y-2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-border/90 bg-surface/94 p-2 shadow-md backdrop-blur-md dark:border-[#413830]">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  value={effectiveQuery}
                  onChange={(e) => {
                    const nextQ = e.target.value;
                    setSearchDraft(nextQ);
                    updateMapUrlFilters({ ...filters, q: nextQ });
                  }}
                  placeholder="Search spots on map..."
                  aria-label="Search spots on map"
                  className="min-h-10 border-transparent bg-surface-elevated/70 pr-8 pl-9 shadow-none focus-visible:border-ring"
                />
                {effectiveQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      updateMapUrlFilters({ ...filters, q: "" });
                    }}
                    aria-label="Clear map search"
                    className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateMapUrlFilters(filters, { openFilter: true })}
                className={cn(
                  "min-h-10 shrink-0 gap-1.5 rounded-xl",
                  activeSheetFiltersCount > 0 && "border-accent/55 bg-accent/10 text-ink",
                )}
              >
                <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
                <span>Filters</span>
                {activeSheetFiltersCount > 0 ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink">
                    {activeSheetFiltersCount}
                  </span>
                ) : null}
              </Button>
            </div>

            {/* Quick Status Pills & Active Scope Chips */}
            <div className="no-scrollbar pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                aria-pressed={selectedStatuses.length === 0}
                onClick={() => handleStatusPillClick("all")}
                className={cn(
                  "min-h-8 shrink-0 cursor-pointer rounded-full border px-3 text-xs font-medium shadow-xs backdrop-blur-md transition-colors",
                  selectedStatuses.length === 0
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-border bg-surface/92 text-ink hover:bg-surface",
                )}
              >
                All · {filteredSpots.length}
              </button>

              {RESTAURANT_STATUSES.map((status) => {
                const active = selectedStatuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleStatusPillClick(status)}
                    className={cn(
                      "min-h-8 shrink-0 cursor-pointer rounded-full border px-3 text-xs font-medium shadow-xs backdrop-blur-md transition-colors",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border bg-surface/92 text-muted hover:text-ink",
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                );
              })}

              {listId && listDetailQuery.data ? (
                <button
                  type="button"
                  onClick={() => updateMapUrlFilters(filters, { listId: null })}
                  className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-accent/50 bg-surface/95 px-3 text-xs font-medium text-ink shadow-xs"
                >
                  <span>List: {listDetailQuery.data.list.name}</span>
                  <X className="size-3 text-muted" aria-hidden="true" />
                </button>
              ) : null}

              {selectedCityLabels.map((cityLabel) => (
                <span
                  key={cityLabel}
                  className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-border bg-surface/92 px-3 text-xs font-medium text-ink shadow-xs"
                >
                  {cityLabel}
                </span>
              ))}

              {mappableSpots.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFitTrigger((c) => c + 1)}
                  className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border bg-surface/92 px-3 text-xs font-medium text-ink shadow-xs hover:bg-surface"
                  title="Fit map to visible spots"
                >
                  <Crosshair className="size-3.5 text-accent" aria-hidden="true" />
                  Fit all
                </button>
              ) : null}
            </div>

            {missingCoordsCount > 0 ? (
              <p className="pointer-events-auto inline-block rounded-full border border-border bg-surface/92 px-3 py-1 text-[11px] text-muted shadow-xs backdrop-blur-md">
                {missingCoordsCount} {missingCoordsCount === 1 ? "spot has" : "spots have"} no saved
                pin coordinates yet
              </p>
            ) : null}

            {filteredSpots.length === 0 && restaurants.length > 0 ? (
              <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-2.5 text-xs text-muted shadow-md">
                <span>No spots match your current map filters.</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft("");
                    updateMapUrlFilters(clearAllLibraryFilters());
                  }}
                  className="cursor-pointer font-medium text-accent hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom Tapped-Pin Peek Card */}
        {selectedSpot ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
            <div className="mx-auto max-w-lg">
              <MapPeekCard restaurant={selectedSpot} onClose={() => setSelectedId(null)} />
            </div>
          </div>
        ) : null}
      </div>

      {isFilterOpen ? (
        <DynamicFilterSheet
          key={`map-filter:${searchParams.toString()}`}
          open={isFilterOpen}
          onOpenChange={(open) => {
            if (!open) closeFilterSheet();
          }}
          initialFilters={filters}
          allRestaurants={scopedRestaurants}
          lists={lists}
          onApply={(next) => {
            setSearchDraft(next.q);
            updateMapUrlFilters(next, { openFilter: false });
          }}
        />
      ) : null}
    </div>
  );
}
