"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownWideNarrow,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Globe2,
  Layers,
  LayoutList,
  MapPin,
  Plus,
  Rows3,
  Search,
  SlidersHorizontal,
  Utensils,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { PlaceCard } from "@/components/places/place-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { usePlacesDensity, type PlacesDensity } from "@/lib/places/density-store";
import {
  FACET_REGISTRY,
  extractFacetOptions,
  filterAndSortRestaurants,
  groupRestaurantsByFacet,
  matchesLibraryFilters,
  suggestFacetsForQuery,
  type FacetId,
  type GroupByOption,
  type LibraryFilters,
} from "@/lib/places/facets";
import {
  clearAllLibraryFilters,
  countActiveSheetFilters,
  getActiveFacetChips,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
  setSingleFacetValue,
  toggleFacetValue,
  toggleListFilterValue,
} from "@/lib/places/filter-state";
import { setSharedFilters } from "@/lib/places/filter-store";
import { usePendingDeleteIds } from "@/lib/places/pending-delete";
import { useListsQuery } from "@/lib/queries/lists";
import { usePlansQuery } from "@/lib/queries/plans";
import {
  usePlacesAutocompleteQuery,
  useRestaurantsQuery,
  type AutocompleteSuggestionItem,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { RESTAURANT_STATUSES, STATUS_LABELS, type RestaurantStatus } from "@/lib/validation/places";

const DynamicFilterSheet = dynamic(
  () => import("@/components/places/filter-sheet").then((mod) => mod.FilterSheet),
  { ssr: false },
);

const DynamicAddToListsSheet = dynamic(
  () => import("@/components/lists/add-to-lists-sheet").then((mod) => mod.AddToListsSheet),
  { ssr: false },
);

function VirtualizedPlaceCards({
  items,
  highlightId,
  density,
  onQuickFilter,
  onOpenLists,
}: {
  items: UserRestaurantItem[];
  highlightId: string | null;
  density: PlacesDensity;
  onQuickFilter: (facetId: FacetId, key: string) => void;
  onOpenLists: (item: UserRestaurantItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => (density === "compact" ? 76 : 176),
    overscan: 6,
  });

  return (
    <div ref={listRef}>
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={cn(
                "absolute top-0 left-0 w-full",
                density === "compact" ? "pb-1.5" : "pb-3",
              )}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <PlaceCard
                item={item}
                density={density}
                highlighted={highlightId === item.id}
                onQuickFilter={onQuickFilter}
                onOpenLists={onOpenLists}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlacesLibrary({
  initialRestaurants,
}: {
  initialRestaurants: UserRestaurantItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const isFilterOpen = searchParams.get("filter") === "1";
  const focusedSection = searchParams.get("section") as FacetId | null;

  const { data: rawRestaurants = initialRestaurants } = useRestaurantsQuery(initialRestaurants);
  const pendingDeleteIds = usePendingDeleteIds();
  const restaurants = useMemo(
    () =>
      pendingDeleteIds.size === 0
        ? rawRestaurants
        : rawRestaurants.filter((item) => !pendingDeleteIds.has(item.id)),
    [pendingDeleteIds, rawRestaurants],
  );
  const { data: lists } = useListsQuery();
  const { data: plans = [] } = usePlansQuery();
  const upcomingPlanCount = useMemo(
    () => plans.filter((plan) => plan.status === "planned").length,
    [plans],
  );
  const filters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams]);

  // Keep instant controlled typing state synced without lagging URL updates on every keystroke.
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const effectiveQuery = searchDraft ?? filters.q;
  const deferredQuery = useDeferredValue(effectiveQuery);

  const [density, setDensity] = usePlacesDensity();
  const [includeGoogleMaps, setIncludeGoogleMaps] = useState(true);
  const [googleSessionToken, setGoogleSessionToken] = useState(() => crypto.randomUUID());

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean | undefined>>({});
  const [listTarget, setListTarget] = useState<UserRestaurantItem | null>(null);

  const trimmedQuery = effectiveQuery.trim();
  const isUnifiedSearchActive = trimmedQuery.length >= 3;
  const googleSearch = usePlacesAutocompleteQuery({
    query: effectiveQuery,
    sessionToken: googleSessionToken,
    enabled: isUnifiedSearchActive && includeGoogleMaps && restaurants.length > 0,
    debounceMs: 350,
  });

  const savedByGooglePlaceId = useMemo(() => {
    const map = new Map<string, UserRestaurantItem>();
    for (const r of restaurants) {
      map.set(r.googlePlaceId, r);
    }
    return map;
  }, [restaurants]);

  function handleQuickAddFromGoogle(suggestion: AutocompleteSuggestionItem) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("add", "1");
    next.set("placeId", suggestion.googlePlaceId);
    next.set("session", googleSessionToken);
    setGoogleSessionToken(crypto.randomUUID());
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const effectiveFilters = useMemo<LibraryFilters>(
    () => ({
      ...filters,
      q: deferredQuery,
    }),
    [deferredQuery, filters],
  );

  useEffect(() => {
    setSharedFilters(filters);
  }, [filters]);

  const updateUrlFilters = useCallback(
    (next: LibraryFilters, extra?: { openFilter?: boolean; section?: FacetId | null }) => {
      setSharedFilters(next);
      const serialized = serializeFiltersToSearchParams(
        next,
        new URLSearchParams(searchParams.toString()),
      );
      if (extra?.openFilter === true) {
        serialized.set("filter", "1");
        if (extra.section) {
          serialized.set("section", extra.section);
        } else {
          serialized.delete("section");
        }
      } else if (extra?.openFilter === false) {
        serialized.delete("filter");
        serialized.delete("section");
      }
      const qs = serialized.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function handleSearchChange(nextValue: string) {
    setSearchDraft(nextValue);
    updateUrlFilters({ ...filters, q: nextValue });
  }

  function handleToggleStatus(status: RestaurantStatus | "all") {
    if (status === "all") {
      updateUrlFilters(setSingleFacetValue(filters, "status", null));
      return;
    }
    const current = filters.facets.status ?? [];
    if (current.length === 1 && current[0] === status) {
      updateUrlFilters(setSingleFacetValue(filters, "status", null));
    } else {
      updateUrlFilters(setSingleFacetValue(filters, "status", status));
    }
  }

  function handleQuickFilter(facetId: FacetId, key: string) {
    updateUrlFilters(toggleFacetValue(filters, facetId, key));
  }

  function handleGroupByChange(groupBy: GroupByOption) {
    setExpandedGroups({});
    updateUrlFilters({ ...filters, groupBy });
  }

  function openFilterSheet(section?: FacetId) {
    updateUrlFilters(filters, { openFilter: true, section: section ?? null });
  }

  function closeFilterSheet() {
    const current = new URLSearchParams(searchParams.toString());
    if (!current.has("filter") && !current.has("section")) return;
    current.delete("filter");
    current.delete("section");
    const qs = current.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Status tab counts reflect all active non-status filters cleanly
  const statusCounts = useMemo(() => {
    const counts: Record<RestaurantStatus | "all", number> = {
      all: 0,
      to_try: 0,
      exploration: 0,
      tried: 0,
    };
    for (const r of restaurants) {
      if (!matchesLibraryFilters(r, effectiveFilters, { excludeFacetId: "status", lists }))
        continue;
      counts.all += 1;
      counts[r.status] += 1;
    }
    return counts;
  }, [effectiveFilters, lists, restaurants]);

  const filteredRestaurants = useMemo(
    () => filterAndSortRestaurants(restaurants, effectiveFilters, { lists }),
    [effectiveFilters, lists, restaurants],
  );

  const listNameById = useMemo(
    () => new Map((lists ?? []).map((list) => [list.id, list.name])),
    [lists],
  );

  const groupedSections = useMemo(() => {
    if (effectiveFilters.groupBy === "none") return null;
    return groupRestaurantsByFacet(
      filteredRestaurants,
      effectiveFilters.groupBy,
      effectiveFilters.groupSort,
    );
  }, [effectiveFilters.groupBy, effectiveFilters.groupSort, filteredRestaurants]);

  const labelLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const facetId of ["city", "cuisine", "price", "country"] as const) {
      for (const opt of extractFacetOptions(restaurants, facetId)) {
        map.set(`${facetId}:${opt.key}`, opt.label);
      }
    }
    return map;
  }, [restaurants]);

  const quickSuggestions = useMemo(
    () => suggestFacetsForQuery(restaurants, effectiveQuery, filters.facets),
    [effectiveQuery, filters.facets, restaurants],
  );

  const countryCount = useMemo(
    () => extractFacetOptions(restaurants, "country").length,
    [restaurants],
  );
  const cityCount = useMemo(() => extractFacetOptions(restaurants, "city").length, [restaurants]);
  const cuisineCount = useMemo(
    () => extractFacetOptions(restaurants, "cuisine").length,
    [restaurants],
  );

  const activeStatusList = filters.facets.status ?? [];
  const activeStatus =
    activeStatusList.length === 1 ? (activeStatusList[0] as RestaurantStatus) : "all";
  const activeSheetCount = countActiveSheetFilters(filters, { excludeFacets: ["status"] });
  const activeFacetChips = getActiveFacetChips(filters, labelLookup);
  const hasAnyActiveFilter =
    Boolean(effectiveQuery.trim()) ||
    activeStatusList.length > 0 ||
    activeFacetChips.length > 0 ||
    filters.listIds.length > 0 ||
    filters.minRatingHalf !== null ||
    filters.sort !== "updated_desc";

  const groupChoices: Array<{ id: GroupByOption; label: string; show?: boolean }> = [
    { id: "none", label: "All spots", show: true },
    { id: "city", label: "By City", show: true },
    { id: "cuisine", label: "By Cuisine", show: true },
    { id: "country", label: "By Country", show: countryCount >= 2 },
    { id: "price", label: "By Price", show: true },
  ];

  function isGroupExpanded(group: { key: string; items: { id: string }[] }): boolean {
    const explicit = expandedGroups[group.key];
    if (explicit !== undefined) return explicit;
    if (highlightId) {
      return group.items.some((item) => item.id === highlightId);
    }
    return false;
  }

  function toggleGroupExpanded(group: { key: string; items: { id: string }[] }) {
    const nextExpanded = !isGroupExpanded(group);
    setExpandedGroups((prev) => ({
      ...prev,
      [group.key]: nextExpanded,
    }));
  }

  function handleExpandCollapseAll() {
    if (!groupedSections) return;
    const anyExpanded = groupedSections.some((g) => isGroupExpanded(g));
    const next: Record<string, boolean> = {};
    for (const g of groupedSections) {
      next[g.key] = !anyExpanded;
    }
    setExpandedGroups(next);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Places</h1>
          <p className="mt-1 text-sm text-muted">
            {restaurants.length === 0
              ? "Save spots from Google Maps to build your library."
              : `${restaurants.length} saved ${restaurants.length === 1 ? "spot" : "spots"}${
                  cityCount > 0 ? ` across ${cityCount} ${cityCount === 1 ? "city" : "cities"}` : ""
                }.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/plans"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <CalendarClock className="size-4" aria-hidden="true" />
            <span>Plans</span>
            {upcomingPlanCount > 0 ? (
              <span className="rounded-full bg-accent/15 px-1.5 text-xs font-semibold text-accent tabular-nums">
                {upcomingPlanCount}
              </span>
            ) : null}
          </Link>

          <Button
            type="button"
            variant={activeSheetCount > 0 ? "primary" : "outline"}
            size="sm"
            onClick={() => openFilterSheet()}
            className="gap-1.5"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <span>Filters</span>
            {activeSheetCount > 0 ? (
              <span className="rounded-full bg-surface/20 px-1.5 text-xs font-semibold tabular-nums">
                {activeSheetCount}
              </span>
            ) : null}
          </Button>
        </div>
      </header>

      {restaurants.length === 0 ? (
        <EmptyState
          title="Nothing on the menu yet"
          description="Paste a Google Maps link, search by name, or save spots from curated vegetarian city guides."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Link href="/places?add=1" className={cn(buttonVariants({ variant: "primary" }))}>
                Add first spot
              </Link>
              <Link href="/lists?tab=browse" className={cn(buttonVariants({ variant: "outline" }))}>
                Browse guides
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {/* Sticky top controls so filters, search, status, and grouping remain in sight while scrolling */}
          <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-border/75 bg-bg/95 px-4 pt-2 pb-2.5 backdrop-blur-md sm:mx-0 sm:px-0">
            {/* Instant search + compact Filters trigger + quick facet suggestions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Label htmlFor="library-search-input" className="sr-only">
                    Search saved restaurants
                  </Label>
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <Input
                    id="library-search-input"
                    type="search"
                    value={effectiveQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search places or Google Maps..."
                    className="pl-10 pr-10"
                  />
                  {effectiveQuery ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchDraft("");
                        setGoogleSessionToken(crypto.randomUUID());
                        updateUrlFilters({ ...filters, q: "" });
                      }}
                      className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:text-ink"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-label={
                    activeSheetCount > 0
                      ? `Open filters (${activeSheetCount} active)`
                      : "Open filters"
                  }
                  title="Filters"
                  onClick={() => openFilterSheet()}
                  className={cn(
                    "relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    activeSheetCount > 0
                      ? "border-accent/45 bg-accent/12 text-ink hover:bg-accent/20"
                      : "border-border bg-surface text-ink hover:bg-surface-elevated",
                  )}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  {activeSheetCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white tabular-nums">
                      {activeSheetCount}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={includeGoogleMaps}
                    onClick={() => setIncludeGoogleMaps((prev) => !prev)}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:gap-1.5 sm:px-3 sm:text-xs",
                      includeGoogleMaps
                        ? "border-accent/45 bg-accent/12 text-ink hover:bg-accent/20"
                        : "border-border bg-surface text-muted hover:text-ink",
                    )}
                  >
                    <MapPin
                      className={cn(
                        "size-3 sm:size-3.5",
                        includeGoogleMaps ? "text-accent" : "text-muted",
                      )}
                      aria-hidden="true"
                    />
                    <span>Include Google Maps</span>
                  </button>

                  {quickSuggestions.length > 0 ? (
                    <>
                      <span className="pl-1 text-xs text-muted">Filter by:</span>
                      {quickSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.facetId}:${suggestion.key}`}
                          type="button"
                          onClick={() => {
                            setSearchDraft("");
                            updateUrlFilters(
                              toggleFacetValue(
                                { ...filters, q: "" },
                                suggestion.facetId,
                                suggestion.key,
                              ),
                            );
                          }}
                          className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-ink transition-colors hover:bg-accent/20"
                        >
                          <span className="text-muted">{suggestion.facetLabel}:</span>
                          <span>{suggestion.label}</span>
                          <span className="text-muted tabular-nums">({suggestion.count})</span>
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>

                <div
                  role="group"
                  aria-label="Card density"
                  className="ml-auto inline-flex shrink-0 items-center rounded-full border border-border bg-surface-elevated p-0.5"
                >
                  <button
                    type="button"
                    aria-pressed={density === "comfortable"}
                    onClick={() => setDensity("comfortable")}
                    title="Comfort view"
                    className={cn(
                      "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:px-2.5 sm:text-xs",
                      density === "comfortable"
                        ? "bg-ink text-bg shadow-2xs"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    <LayoutList className="size-3 sm:size-3.5" aria-hidden="true" />
                    <span>Comfort</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={density === "compact"}
                    onClick={() => setDensity("compact")}
                    title="Compact view"
                    className={cn(
                      "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:px-2.5 sm:text-xs",
                      density === "compact"
                        ? "bg-ink text-bg shadow-2xs"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    <Rows3 className="size-3 sm:size-3.5" aria-hidden="true" />
                    <span>Compact</span>
                  </button>
                </div>
              </div>

              {trimmedQuery.length > 0 && trimmedQuery.length < 3 && includeGoogleMaps ? (
                <p className="text-xs text-muted">
                  Type {3 - trimmedQuery.length} more letter
                  {3 - trimmedQuery.length === 1 ? "" : "s"} for Google Maps
                </p>
              ) : null}
            </div>

            {/* Status Segmented Tabs */}
            <div
              role="tablist"
              aria-label="Filter by status"
              className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            >
              <Chip
                role="tab"
                aria-selected={activeStatus === "all"}
                interactive
                selected={activeStatus === "all"}
                onClick={() => handleToggleStatus("all")}
                className="shrink-0"
              >
                All · {statusCounts.all}
              </Chip>
              {RESTAURANT_STATUSES.map((status) => (
                <Chip
                  key={status}
                  role="tab"
                  aria-selected={activeStatus === status}
                  interactive
                  selected={activeStatus === status}
                  tone={activeStatus === status ? "accent" : status}
                  onClick={() => handleToggleStatus(status)}
                  className="shrink-0"
                >
                  {STATUS_LABELS[status]} · {statusCounts[status]}
                </Chip>
              ))}
            </div>

            {/* Group By & Quick City/Cuisine Triggers */}
            <div className="space-y-2">
              <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div
                  role="group"
                  aria-label="Group spots by"
                  className="inline-flex shrink-0 items-center rounded-full border border-border bg-surface-elevated p-0.5"
                >
                  {groupChoices
                    .filter((c) => c.show)
                    .map((choice) => {
                      const active = filters.groupBy === choice.id;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => handleGroupByChange(choice.id)}
                          className={cn(
                            "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                            active ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
                          )}
                        >
                          {choice.id === "none" ? (
                            <Layers className="size-3.5" aria-hidden="true" />
                          ) : null}
                          {choice.id === "city" ? (
                            <MapPin className="size-3.5" aria-hidden="true" />
                          ) : null}
                          {choice.id === "cuisine" ? (
                            <Utensils className="size-3.5" aria-hidden="true" />
                          ) : null}
                          {choice.id === "country" ? (
                            <Globe2 className="size-3.5" aria-hidden="true" />
                          ) : null}
                          <span>{choice.label}</span>
                        </button>
                      );
                    })}
                </div>

                {cityCount > 0 ? (
                  <Button
                    type="button"
                    variant={(filters.facets.city?.length ?? 0) > 0 ? "primary" : "outline"}
                    size="sm"
                    onClick={() => openFilterSheet("city")}
                    className="min-h-10 shrink-0 gap-1 rounded-full px-3 text-xs"
                  >
                    <MapPin className="size-3.5" aria-hidden="true" />
                    Cities
                    {(filters.facets.city?.length ?? 0) > 0
                      ? ` (${filters.facets.city?.length})`
                      : ""}
                  </Button>
                ) : null}

                {cuisineCount > 0 ? (
                  <Button
                    type="button"
                    variant={(filters.facets.cuisine?.length ?? 0) > 0 ? "primary" : "outline"}
                    size="sm"
                    onClick={() => openFilterSheet("cuisine")}
                    className="min-h-10 shrink-0 gap-1 rounded-full px-3 text-xs"
                  >
                    <Utensils className="size-3.5" aria-hidden="true" />
                    Cuisines
                    {(filters.facets.cuisine?.length ?? 0) > 0
                      ? ` (${filters.facets.cuisine?.length})`
                      : ""}
                  </Button>
                ) : null}
              </div>

              {/* Active filter removable chips */}
              {activeFacetChips.length > 0 ||
              filters.listIds.length > 0 ||
              filters.minRatingHalf !== null ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeFacetChips.map((chip) => (
                    <button
                      key={`${chip.facetId}:${chip.key}`}
                      type="button"
                      onClick={() =>
                        updateUrlFilters(toggleFacetValue(filters, chip.facetId, chip.key))
                      }
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-accent/35 bg-accent/10 px-2.5 text-xs font-medium text-ink hover:bg-accent/20"
                    >
                      <span className="text-muted">{chip.facetLabel}:</span>{" "}
                      <span>{chip.label}</span>
                      <X className="size-3 text-muted" aria-hidden="true" />
                    </button>
                  ))}

                  {filters.listIds.map((listId) => (
                    <button
                      key={`list:${listId}`}
                      type="button"
                      onClick={() => updateUrlFilters(toggleListFilterValue(filters, listId))}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-accent/35 bg-accent/10 px-2.5 text-xs font-medium text-ink hover:bg-accent/20"
                    >
                      <span className="text-muted">List:</span>{" "}
                      <span>{listNameById.get(listId) ?? "Saved list"}</span>
                      <X className="size-3 text-muted" aria-hidden="true" />
                    </button>
                  ))}

                  {filters.minRatingHalf !== null ? (
                    <button
                      type="button"
                      onClick={() => updateUrlFilters({ ...filters, minRatingHalf: null })}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-accent/35 bg-accent/10 px-2.5 text-xs font-medium text-ink hover:bg-accent/20"
                    >
                      <span>{(filters.minRatingHalf / 2).toFixed(1)}★+</span>
                      <X className="size-3 text-muted" aria-hidden="true" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      updateUrlFilters(clearAllLibraryFilters(filters));
                    }}
                    className="cursor-pointer px-2 text-xs font-medium text-accent hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {/* Results area */}
            {isUnifiedSearchActive ? (
              <div className="space-y-6">
                <section aria-label="From your Saved Places" className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-serif text-lg font-medium text-ink">
                      From your Saved Places
                    </h2>
                    <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-muted tabular-nums">
                      {filteredRestaurants.length}
                    </span>
                  </div>

                  {filteredRestaurants.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-4 text-sm text-muted">
                      No saved places match &ldquo;{trimmedQuery}&rdquo;.
                      {!includeGoogleMaps ? (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={() => setIncludeGoogleMaps(true)}
                            className="cursor-pointer font-medium text-accent underline underline-offset-2"
                          >
                            Search Google Maps
                          </button>
                        </>
                      ) : null}
                    </p>
                  ) : filteredRestaurants.length > 100 ? (
                    <VirtualizedPlaceCards
                      key={density}
                      items={filteredRestaurants}
                      density={density}
                      highlightId={highlightId}
                      onQuickFilter={handleQuickFilter}
                      onOpenLists={setListTarget}
                    />
                  ) : (
                    <div className={density === "compact" ? "space-y-1.5" : "space-y-3"}>
                      {filteredRestaurants.map((item) => (
                        <PlaceCard
                          key={item.id}
                          item={item}
                          density={density}
                          highlighted={highlightId === item.id}
                          onQuickFilter={handleQuickFilter}
                          onOpenLists={setListTarget}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {includeGoogleMaps ? (
                  <section aria-label="From Google Maps" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="font-serif text-lg font-medium text-ink">
                          From Google Maps
                        </h2>
                        {!googleSearch.isLoading && !googleSearch.error ? (
                          <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-muted tabular-nums">
                            {googleSearch.suggestions.length}
                          </span>
                        ) : null}
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <MapPin className="size-3" aria-hidden="true" />
                        Powered by Google
                      </span>
                    </div>

                    {googleSearch.isLoading ? (
                      <div className="space-y-2" aria-label="Searching Google Maps">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : googleSearch.error ? (
                      <p className="rounded-2xl border border-border bg-surface-elevated/60 px-4 py-3 text-xs text-muted">
                        {googleSearch.error instanceof Error
                          ? googleSearch.error.message
                          : "Could not load Google Maps results right now."}
                      </p>
                    ) : typeof navigator !== "undefined" && navigator.onLine === false ? (
                      <p className="rounded-2xl border border-border bg-surface-elevated/60 px-4 py-3 text-xs text-muted">
                        You&apos;re offline — showing saved places only.
                      </p>
                    ) : googleSearch.suggestions.length > 0 ? (
                      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                        {googleSearch.suggestions.map((suggestion) => {
                          const existingSaved = savedByGooglePlaceId.get(suggestion.googlePlaceId);
                          const rowContent = (
                            <>
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
                                <FoodIcon
                                  name={mapCuisinesToFoodIcon(suggestion.cuisines)}
                                  className="size-4"
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-ink">
                                  {suggestion.mainText}
                                </span>
                                {suggestion.secondaryText ? (
                                  <span className="block truncate text-xs text-muted">
                                    {suggestion.secondaryText}
                                  </span>
                                ) : null}
                              </span>
                              {existingSaved ? (
                                <span className="inline-flex min-h-7 shrink-0 items-center rounded-full bg-tried-bg px-2.5 text-xs font-medium text-tried-ink">
                                  Saved · Open
                                </span>
                              ) : (
                                <span className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-accent">
                                  <Plus className="size-3.5" aria-hidden="true" />
                                  Add
                                </span>
                              )}
                            </>
                          );
                          const rowClassName =
                            "flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-elevated/70 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring";

                          return (
                            <li key={suggestion.googlePlaceId}>
                              {existingSaved ? (
                                <Link href={`/places/${existingSaved.id}`} className={rowClassName}>
                                  {rowContent}
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddFromGoogle(suggestion)}
                                  className={cn(rowClassName, "cursor-pointer")}
                                >
                                  {rowContent}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : googleSearch.debouncedQuery.length >= 3 ? (
                      <p className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-3 text-xs text-muted">
                        No Google Maps matches for &ldquo;{trimmedQuery}&rdquo;. Try including a
                        city.
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <EmptyState
                title="No matching spots"
                description="Try clearing a city, cuisine, or search filter to see more restaurants."
                action={
                  hasAnyActiveFilter ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSearchDraft("");
                        updateUrlFilters(clearAllLibraryFilters(filters));
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            ) : groupedSections ? (
              <div className="space-y-6 pt-1">
                {/* Sleek borderless quick-jump bar + sort/collapse controls */}
                <div className="space-y-2.5 border-b border-border/70 pb-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="font-medium">
                      {groupedSections.length}{" "}
                      {groupedSections.length === 1
                        ? FACET_REGISTRY[effectiveFilters.groupBy as FacetId].label.toLowerCase()
                        : FACET_REGISTRY[
                            effectiveFilters.groupBy as FacetId
                          ].pluralLabel.toLowerCase()}
                      {" · "}
                      {filteredRestaurants.length}{" "}
                      {filteredRestaurants.length === 1 ? "spot" : "spots"}
                    </span>
                    <div className="flex items-center gap-2">
                      {FACET_REGISTRY[effectiveFilters.groupBy as FacetId].supportsGroupSort ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateUrlFilters({
                              ...filters,
                              groupSort:
                                filters.groupSort === "count_desc" ? "alpha_asc" : "count_desc",
                            })
                          }
                          className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-surface px-2.5 font-medium text-ink hover:bg-surface-elevated"
                        >
                          <ArrowDownWideNarrow className="size-3" aria-hidden="true" />
                          {filters.groupSort === "count_desc" ? "Most spots" : "A–Z"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleExpandCollapseAll}
                        className="inline-flex min-h-8 cursor-pointer items-center rounded-full px-2 font-medium text-accent hover:underline"
                      >
                        {groupedSections.some((g) => isGroupExpanded(g))
                          ? "Collapse all"
                          : "Expand all"}
                      </button>
                    </div>
                  </div>

                  {groupedSections.length > 1 ? (
                    <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                      {groupedSections.map((group) => (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => {
                            setExpandedGroups((prev) => ({ ...prev, [group.key]: true }));
                            document
                              .getElementById(`facet-group-${group.key}`)
                              ?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          {group.iconKey ? (
                            <FoodIcon name={group.iconKey} className="size-3.5 text-accent" />
                          ) : null}
                          <span>{group.label}</span>
                          <span className="text-muted tabular-nums">{group.items.length}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Distinct Editorial Chapter Sections */}
                <div className="space-y-8">
                  {groupedSections.map((group) => {
                    const expanded = isGroupExpanded(group);
                    const activeFacetId = effectiveFilters.groupBy as FacetId;

                    return (
                      <section
                        key={group.key}
                        id={`facet-group-${group.key}`}
                        className="scroll-mt-60 sm:scroll-mt-56"
                      >
                        <div className="flex items-center justify-between gap-2 px-1">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => toggleGroupExpanded(group)}
                            className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <span
                              aria-hidden="true"
                              className="h-5 w-1 shrink-0 rounded-full bg-accent"
                            />
                            {group.iconKey ? (
                              <FoodIcon
                                name={group.iconKey}
                                className="size-5 shrink-0 text-accent"
                              />
                            ) : (
                              <MapPin
                                className="size-4.5 shrink-0 text-accent"
                                aria-hidden="true"
                              />
                            )}
                            <h2 className="truncate font-serif text-xl font-medium tracking-tight text-ink sm:text-2xl">
                              {group.label}
                            </h2>
                            {group.subtitle ? (
                              <span className="shrink-0 text-xs font-medium tracking-wide text-muted uppercase">
                                {group.subtitle}
                              </span>
                            ) : null}
                            <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent tabular-nums">
                              {group.items.length}
                            </span>
                            {expanded ? (
                              <ChevronUp
                                className="size-4 shrink-0 text-muted"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                className="size-4 shrink-0 text-muted"
                                aria-hidden="true"
                              />
                            )}
                          </button>

                          {!group.isEmptyBucket ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateUrlFilters(
                                  setSingleFacetValue(
                                    { ...filters, groupBy: "none" },
                                    activeFacetId,
                                    group.key,
                                  ),
                                )
                              }
                              className="inline-flex min-h-8 shrink-0 cursor-pointer items-center rounded-full border border-border bg-surface px-3 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink"
                              title={`Filter only ${group.label}`}
                            >
                              Filter only
                            </button>
                          ) : null}
                        </div>

                        {expanded ? (
                          <div className="mt-2.5 rounded-2xl border border-border/80 bg-surface-elevated/55 p-2.5 sm:p-3 dark:border-border/75 dark:bg-[#191512]">
                            <div className={density === "compact" ? "space-y-1.5" : "space-y-2.5"}>
                              {group.items.map((item) => (
                                <PlaceCard
                                  key={`${group.key}-${item.id}`}
                                  item={item}
                                  density={density}
                                  highlighted={highlightId === item.id}
                                  onQuickFilter={handleQuickFilter}
                                  onOpenLists={setListTarget}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : filteredRestaurants.length > 100 ? (
              <VirtualizedPlaceCards
                key={density}
                items={filteredRestaurants}
                density={density}
                highlightId={highlightId}
                onQuickFilter={handleQuickFilter}
                onOpenLists={setListTarget}
              />
            ) : (
              <div className={density === "compact" ? "space-y-1.5" : "space-y-3"}>
                {filteredRestaurants.map((item) => (
                  <PlaceCard
                    key={item.id}
                    item={item}
                    density={density}
                    highlighted={highlightId === item.id}
                    onQuickFilter={handleQuickFilter}
                    onOpenLists={setListTarget}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isFilterOpen ? (
        <DynamicFilterSheet
          key={`${isFilterOpen}:${searchParams.toString()}`}
          open={isFilterOpen}
          onOpenChange={(open) => {
            if (!open) closeFilterSheet();
          }}
          initialFilters={filters}
          allRestaurants={restaurants}
          lists={lists}
          focusedFacet={focusedSection}
          onApply={(next) => {
            setSearchDraft(next.q);
            updateUrlFilters(next, { openFilter: false });
          }}
        />
      ) : null}

      {listTarget ? (
        <DynamicAddToListsSheet
          restaurant={listTarget}
          open={Boolean(listTarget)}
          onOpenChange={(open) => {
            if (!open) setListTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
