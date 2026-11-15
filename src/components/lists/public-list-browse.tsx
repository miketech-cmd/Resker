"use client";

import { Check, ChevronRight, Globe, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { usePublicListsQuery, type PublicListSummaryItem } from "@/lib/queries/lists";
import { cn } from "@/lib/utils";

const PREFERRED_CITY_ORDER = ["New York", "Seattle", "Bellevue", "Redmond", "San Francisco"];

export function PublicListBrowse({
  initialLists,
  detailBasePath,
  viewerSignedIn,
}: {
  initialLists: PublicListSummaryItem[];
  detailBasePath: "/lists/public" | "/s";
  viewerSignedIn: boolean;
}) {
  const { data: lists = initialLists } = usePublicListsQuery({}, initialLists);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("All");

  const cityOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of lists) {
      if (item.city?.trim()) seen.add(item.city.trim());
    }
    const ordered: string[] = [];
    for (const preferred of PREFERRED_CITY_ORDER) {
      if (seen.has(preferred)) {
        ordered.push(preferred);
        seen.delete(preferred);
      }
    }
    for (const rest of Array.from(seen).sort((a, b) => a.localeCompare(b))) {
      ordered.push(rest);
    }
    return ["All", ...ordered];
  }, [lists]);

  const filteredLists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lists.filter((list) => {
      if (
        selectedCity !== "All" &&
        (list.city ?? "").toLowerCase() !== selectedCity.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        list.name,
        list.description ?? "",
        list.city ?? "",
        list.curatorName,
        list.curatorUsername ?? "",
        ...list.cuisines,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [lists, searchQuery, selectedCity]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Label htmlFor="public-lists-search" className="sr-only">
            Search public lists
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id="public-lists-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, cities, cuisines, or curators..."
            className="pl-10"
          />
        </div>

        {cityOptions.length > 1 ? (
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter public lists by city"
          >
            {cityOptions.map((city) => {
              const active = selectedCity === city;
              return (
                <button
                  key={city}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCity(city)}
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    active
                      ? "border-ink bg-ink text-bg"
                      : "border-border bg-surface text-muted hover:border-accent/45 hover:text-ink dark:border-[#413830]",
                  )}
                >
                  {city}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {filteredLists.length === 0 ? (
        <EmptyState
          title="No matching public lists"
          description={
            searchQuery || selectedCity !== "All"
              ? "Try clearing the search or picking another city."
              : "No public lists have been published yet."
          }
          action={
            searchQuery || selectedCity !== "All" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCity("All");
                }}
                className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-xs font-medium text-ink hover:border-accent/50"
              >
                Reset filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {filteredLists.map((list) => {
            const visibleCuisines = list.cuisines.slice(0, 5);
            return (
              <Link
                key={list.id}
                href={`${detailBasePath}/${list.publicSlug}`}
                className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card
                  className={cn(
                    "flex h-full flex-col justify-between gap-3 transition-colors group-hover:border-accent/45 dark:border-[#413830] dark:group-hover:border-accent/55",
                    list.isFeatured && "border-accent/25 bg-surface",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
                        <FoodIcon name={list.icon} className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          {list.isFeatured ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
                              <Sparkles className="size-2.5" aria-hidden="true" />
                              Curated Guide
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-muted">
                              <Globe className="size-2.5" aria-hidden="true" />
                              Community
                            </span>
                          )}

                          {viewerSignedIn && list.savedCopyListId ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              <Check className="size-2.5" aria-hidden="true" />
                              Saved
                            </span>
                          ) : null}
                        </div>

                        <h2 className="font-serif text-lg leading-snug font-medium text-ink group-hover:text-accent">
                          {list.name}
                        </h2>
                        {list.description ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                            {list.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <ChevronRight
                      className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="space-y-2 border-t border-border/70 pt-2.5">
                    {visibleCuisines.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {visibleCuisines.map((cuisine) => (
                          <Chip key={cuisine} className="px-2 py-0.5 text-[10px]">
                            {cuisine}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-muted tabular-nums">
                      <span>
                        {list.city ? `${list.city} · ` : ""}
                        {list.curatorUsername ? `@${list.curatorUsername}` : list.curatorName}
                      </span>
                      <span>
                        {list.itemCount} {list.itemCount === 1 ? "spot" : "spots"}
                        {list.copyCount > 0 ? ` · ${list.copyCount} saved` : ""}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
