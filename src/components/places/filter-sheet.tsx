"use client";

import { RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { FoodIcon, FOOD_ICON_KEYS, type FoodIconKey } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  FACET_REGISTRY,
  FILTERABLE_FACET_IDS,
  extractFacetOptions,
  filterAndSortRestaurants,
  matchesLibraryFilters,
  type FacetId,
  type GroupSortOption,
  type LibraryFilters,
  type SortOption,
} from "@/lib/places/facets";
import {
  clearAllLibraryFilters,
  toggleFacetValue,
  toggleListFilterValue,
} from "@/lib/places/filter-state";
import { useListsQuery, type ListSummaryItem } from "@/lib/queries/lists";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "city_asc", label: "City (A–Z)" },
];

const RATING_THRESHOLDS: Array<{ value: number | null; label: string }> = [
  { value: null, label: "Any" },
  { value: 7, label: "3.5★+" },
  { value: 8, label: "4.0★+" },
  { value: 9, label: "4.5★+" },
];

const SHEET_FACET_IDS = FILTERABLE_FACET_IDS.filter((id) => id !== "status");

const FOOD_ICON_SET = new Set<string>(FOOD_ICON_KEYS);

function resolveListIconKey(icon: string | null | undefined): FoodIconKey {
  if (icon && FOOD_ICON_SET.has(icon)) {
    return icon as FoodIconKey;
  }
  return "bowl";
}

export function FilterSheet({
  open,
  onOpenChange,
  initialFilters,
  allRestaurants,
  lists: providedLists,
  focusedFacet,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters: LibraryFilters;
  allRestaurants: UserRestaurantItem[];
  lists?: ListSummaryItem[];
  focusedFacet?: FacetId | null;
  onApply: (next: LibraryFilters) => void;
}) {
  const [draft, setDraft] = useState<LibraryFilters>(initialFilters);
  const [facetSearchTerms, setFacetSearchTerms] = useState<Partial<Record<FacetId, string>>>({});
  const { data: fetchedLists = [] } = useListsQuery(providedLists, providedLists === undefined);
  const lists = providedLists ?? fetchedLists;

  const previewCount = useMemo(
    () => filterAndSortRestaurants(allRestaurants, draft, { lists }).length,
    [allRestaurants, draft, lists],
  );

  const listMatchCounts = useMemo(() => {
    if (lists.length === 0) return new Map<string, number>();
    const baseMatched = allRestaurants.filter((item) =>
      matchesLibraryFilters(item, draft, { excludeListFilter: true }),
    );
    const counts = new Map<string, number>();
    for (const list of lists) {
      const restSet = new Set(list.restaurantIds);
      const placeSet = new Set(list.placeIds ?? []);
      let count = 0;
      for (const item of baseMatched) {
        if (restSet.has(item.id) || placeSet.has(item.placeId)) {
          count += 1;
        }
      }
      counts.set(list.id, count);
    }
    return counts;
  }, [allRestaurants, draft, lists]);

  function handleReset() {
    setDraft(clearAllLibraryFilters(draft));
    setFacetSearchTerms({});
  }

  function handleApply() {
    onApply(draft);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[88dvh]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <SheetTitle>Filter & Sort</SheetTitle>
            <SheetDescription>
              Combine cities, cuisines, price range, and rating filters.
            </SheetDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </Button>
        </div>

        <div className="space-y-6 pb-4">
          {/* Sort order */}
          <section className="space-y-2">
            <Label>Sort spots</Label>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map((option) => {
                const active = draft.sort === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, sort: option.value }))}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-xl border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border bg-surface text-ink hover:bg-surface-elevated",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Group section order when grouped */}
          {draft.groupBy !== "none" && FACET_REGISTRY[draft.groupBy].supportsGroupSort ? (
            <section className="space-y-2">
              <Label>Group section order</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "count_desc", label: "Most spots first" },
                    { value: "alpha_asc", label: "Alphabetical (A–Z)" },
                  ] as Array<{ value: GroupSortOption; label: string }>
                ).map((option) => {
                  const active = draft.groupSort === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, groupSort: option.value }))}
                      className={cn(
                        "min-h-11 cursor-pointer rounded-xl border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-border bg-surface text-ink hover:bg-surface-elevated",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Declarative Facet Sections (Cities, Cuisines, Price, Countries, future fields...) */}
          {SHEET_FACET_IDS.map((facetId) => {
            const def = FACET_REGISTRY[facetId];
            const globalOptions = extractFacetOptions(allRestaurants, facetId);
            if (
              def.emptySearchFilterMinCount &&
              globalOptions.length < def.emptySearchFilterMinCount
            ) {
              return null;
            }
            if (globalOptions.length === 0) return null;

            const crossCounts = new Map(
              extractFacetOptions(allRestaurants, facetId, {
                filters: draft,
                excludeSelf: true,
                lists,
              }).map((opt) => [opt.key, opt.count]),
            );

            const selectedSet = new Set(draft.facets[facetId] ?? []);
            const searchQuery = (facetSearchTerms[facetId] ?? "").trim().toLowerCase();
            const visibleOptions = searchQuery
              ? globalOptions.filter(
                  (opt) =>
                    opt.label.toLowerCase().includes(searchQuery) || selectedSet.has(opt.key),
                )
              : globalOptions;

            return (
              <section
                key={facetId}
                id={`filter-section-${facetId}`}
                className={cn(
                  "space-y-2.5",
                  focusedFacet === facetId &&
                    "rounded-2xl border border-accent/40 bg-surface-elevated/40 p-3",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Label>{def.pluralLabel}</Label>
                  {selectedSet.size > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => {
                          const nextFacets = { ...prev.facets };
                          delete nextFacets[facetId];
                          return { ...prev, facets: nextFacets };
                        })
                      }
                      className="cursor-pointer text-xs font-medium text-accent hover:underline"
                    >
                      Clear ({selectedSet.size})
                    </button>
                  ) : null}
                </div>

                {def.searchable && globalOptions.length > 8 ? (
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      value={facetSearchTerms[facetId] ?? ""}
                      onChange={(e) =>
                        setFacetSearchTerms((prev) => ({
                          ...prev,
                          [facetId]: e.target.value,
                        }))
                      }
                      placeholder={`Filter ${def.pluralLabel.toLowerCase()}...`}
                      className="min-h-10 pl-9"
                      aria-label={`Filter ${def.pluralLabel}`}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {visibleOptions.map((option) => {
                    const selected = selectedSet.has(option.key);
                    const matchedCount = crossCounts.get(option.key) ?? 0;
                    return (
                      <Chip
                        key={option.key}
                        interactive
                        selected={selected}
                        onClick={() =>
                          setDraft((prev) => toggleFacetValue(prev, facetId, option.key))
                        }
                        className="min-h-10 gap-1.5 px-3 text-sm"
                      >
                        {option.iconKey ? (
                          <FoodIcon name={option.iconKey} className="size-3.5 shrink-0" />
                        ) : null}
                        <span>{option.label}</span>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            selected ? "text-accent-ink/80" : "text-muted",
                          )}
                        >
                          {matchedCount}
                        </span>
                      </Chip>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* List Membership Filter */}
          {lists.length > 0 ? (
            <section id="filter-section-list" className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Lists</Label>
                {draft.listIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, listIds: [] }))}
                    className="cursor-pointer text-xs font-medium text-accent hover:underline"
                  >
                    Clear ({draft.listIds.length})
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {lists.map((list) => {
                  const selected = draft.listIds.includes(list.id);
                  const matchedCount = listMatchCounts.get(list.id) ?? 0;
                  return (
                    <Chip
                      key={list.id}
                      interactive
                      selected={selected}
                      onClick={() => setDraft((prev) => toggleListFilterValue(prev, list.id))}
                      className="min-h-10 gap-1.5 px-3 text-sm"
                    >
                      <FoodIcon
                        name={resolveListIconKey(list.icon)}
                        className="size-3.5 shrink-0"
                      />
                      <span>{list.name}</span>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          selected ? "text-accent-ink/80" : "text-muted",
                        )}
                      >
                        {matchedCount}
                      </span>
                    </Chip>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Minimum Star Rating */}
          <section className="space-y-2">
            <Label>Minimum rating</Label>
            <div className="grid grid-cols-4 gap-2">
              {RATING_THRESHOLDS.map((option) => {
                const active = draft.minRatingHalf === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, minRatingHalf: option.value }))}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-xl border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border bg-surface text-ink hover:bg-surface-elevated",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 -mx-5 border-t border-border bg-surface px-5 pt-3 pb-1">
          <Button type="button" size="lg" className="w-full" onClick={handleApply}>
            Show {previewCount} {previewCount === 1 ? "spot" : "spots"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
