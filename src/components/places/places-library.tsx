"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownWideNarrow,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Globe2,
  Layers,
  MapPin,
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
} from "@/lib/places/filter-state";
import { setSharedFilters } from "@/lib/places/filter-store";
import { usePlansQuery } from "@/lib/queries/plans";
import { useRestaurantsQuery, type UserRestaurantItem } from "@/lib/queries/restaurants";
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
  onQuickFilter,
  onOpenLists,
}: {
  items: UserRestaurantItem[];
  highlightId: string | null;
  onQuickFilter: (facetId: FacetId, key: string) => void;
  onOpenLists: (item: UserRestaurantItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 176,
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
              className="absolute top-0 left-0 w-full pb-3"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <PlaceCard
                item={item}
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

  const { data: restaurants = initialRestaurants } = useRestaurantsQuery(initialRestaurants);
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

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [listTarget, setListTarget] = useState<UserRestaurantItem | null>(null);

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
    setCollapsedGroups({});
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
      if (!matchesLibraryFilters(r, effectiveFilters, { excludeFacetId: "status" })) continue;
      counts.all += 1;
      counts[r.status] += 1;
    }
    return counts;
  }, [effectiveFilters, restaurants]);

  const filteredRestaurants = useMemo(
    () => filterAndSortRestaurants(restaurants, effectiveFilters),
    [effectiveFilters, restaurants],
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
    filters.minRatingHalf !== null ||
    filters.sort !== "updated_desc";

  const groupChoices: Array<{ id: GroupByOption; label: string; show?: boolean }> = [
    { id: "none", label: "All spots", show: true },
    { id: "city", label: "By City", show: true },
    { id: "cuisine", label: "By Cuisine", show: true },
    { id: "country", label: "By Country", show: countryCount >= 2 },
    { id: "price", label: "By Price", show: true },
  ];

  function toggleGroupCollapsed(groupKey: string) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  function handleExpandCollapseAll() {
    if (!groupedSections) return;
    const anyExpanded = groupedSections.some((g) => !collapsedGroups[g.key]);
    if (anyExpanded) {
      const next: Record<string, boolean> = {};
      for (const g of groupedSections) {
        next[g.key] = true;
      }
      setCollapsedGroups(next);
    } else {
      setCollapsedGroups({});
    }
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
        <div className="space-y-4">
          {/* Instant search + quick facet suggestions */}
          <div className="space-y-2">
            <div className="relative">
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
                placeholder="Search restaurants, cities, cuisines, notes..."
                className="pl-10 pr-10"
              />
              {effectiveQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchDraft("");
                    updateUrlFilters({ ...filters, q: "" });
                  }}
                  className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:text-ink"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {quickSuggestions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Quick facet matches">
                <span className="text-xs text-muted">Filter by:</span>
                {quickSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.facetId}:${suggestion.key}`}
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      updateUrlFilters(
                        toggleFacetValue({ ...filters, q: "" }, suggestion.facetId, suggestion.key),
                      );
                    }}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-ink transition-colors hover:bg-accent/20"
                  >
                    <span className="text-muted">{suggestion.facetLabel}:</span>
                    <span>{suggestion.label}</span>
                    <span className="text-muted tabular-nums">({suggestion.count})</span>
                  </button>
                ))}
              </div>
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
            {activeFacetChips.length > 0 || filters.minRatingHalf !== null ? (
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
                    <span className="text-muted">{chip.facetLabel}:</span>
                    <span>{chip.label}</span>
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

          {/* Results area */}
          {filteredRestaurants.length === 0 ? (
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
                      {groupedSections.some((g) => !collapsedGroups[g.key])
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
                          setCollapsedGroups((prev) => ({ ...prev, [group.key]: false }));
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
                  const collapsed = Boolean(collapsedGroups[group.key]);
                  const activeFacetId = effectiveFilters.groupBy as FacetId;

                  return (
                    <section
                      key={group.key}
                      id={`facet-group-${group.key}`}
                      className="scroll-mt-4"
                    >
                      <div className="flex items-center justify-between gap-2 px-1">
                        <button
                          type="button"
                          aria-expanded={!collapsed}
                          onClick={() => toggleGroupCollapsed(group.key)}
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
                            <MapPin className="size-4.5 shrink-0 text-accent" aria-hidden="true" />
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
                          {collapsed ? (
                            <ChevronDown
                              className="size-4 shrink-0 text-muted"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronUp className="size-4 shrink-0 text-muted" aria-hidden="true" />
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

                      {!collapsed ? (
                        <div className="mt-2.5 rounded-2xl border border-border/80 bg-surface-elevated/55 p-2.5 sm:p-3 dark:border-border/75 dark:bg-[#191512]">
                          <div className="space-y-2.5">
                            {group.items.map((item) => (
                              <PlaceCard
                                key={`${group.key}-${item.id}`}
                                item={item}
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
              items={filteredRestaurants}
              highlightId={highlightId}
              onQuickFilter={handleQuickFilter}
              onOpenLists={setListTarget}
            />
          ) : (
            <div className="space-y-3">
              {filteredRestaurants.map((item) => (
                <PlaceCard
                  key={item.id}
                  item={item}
                  highlighted={highlightId === item.id}
                  onQuickFilter={handleQuickFilter}
                  onOpenLists={setListTarget}
                />
              ))}
            </div>
          )}
        </div>
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
