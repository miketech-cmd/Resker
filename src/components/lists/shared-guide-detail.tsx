"use client";

import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  ExternalLink,
  List as ListIcon,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin,
  Search,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import {
  useLeaveSharedGuideMutation,
  useSaveSharedGuideSpotMutation,
  useSharedGuideDetailQuery,
  type SharedLibraryGuideDetailResponse,
  type SharedLibraryRestaurantItem,
} from "@/lib/queries/shared-guides";
import { cn } from "@/lib/utils";

const PublicListMap = dynamic(
  () => import("@/components/lists/public-list-map").then((mod) => mod.PublicListMap),
  { ssr: false },
);

function SharedGuideSpotCard({
  item,
  isOwnPreview,
  saving,
  onSaveSpot,
}: {
  item: SharedLibraryRestaurantItem;
  isOwnPreview: boolean;
  saving: boolean;
  onSaveSpot: (sourceRestaurantId: string, name: string) => void;
}) {
  const iconKey = mapCuisinesToFoodIcon(item.cuisines);
  const priceLabel = formatPriceLevel(item.priceLevel);
  const visibleCuisines = item.cuisines
    .filter((c) => c.trim().toLowerCase() !== "restaurant")
    .slice(0, 3);

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between dark:border-[#413830]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
          <FoodIcon name={iconKey} className="size-4.5" />
        </span>

        <div className="min-w-0 space-y-1">
          <h3 className="font-serif text-lg leading-snug font-medium text-ink">{item.name}</h3>

          <div className="flex flex-wrap items-center gap-1.5">
            {visibleCuisines.map((cuisine) => (
              <Chip key={cuisine} className="px-2 py-0.5 text-[11px]">
                {cuisine}
              </Chip>
            ))}
            {priceLabel ? (
              <span className="text-xs font-medium text-muted tabular-nums">{priceLabel}</span>
            ) : null}
          </div>

          {item.address || item.city ? (
            <p className="flex items-start gap-1.5 text-xs text-muted">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span>{item.address ?? item.city}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <a
          href={buildMapsPlaceUrl(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface-elevated px-3 text-xs font-medium text-muted hover:border-accent/50 hover:text-ink"
        >
          Maps
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>

        {!isOwnPreview ? (
          item.savedByViewer && item.viewerRestaurantId ? (
            <Link
              href={`/places/${item.viewerRestaurantId}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <Check className="size-3.5" aria-hidden="true" />
              Saved
            </Link>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => onSaveSpot(item.id, item.name)}
              className="gap-1.5"
            >
              <BookmarkPlus className="size-3.5" aria-hidden="true" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )
        ) : null}
      </div>
    </Card>
  );
}

export function SharedGuideDetail({
  initialDetail,
}: {
  initialDetail: SharedLibraryGuideDetailResponse;
}) {
  const router = useRouter();
  const { data = initialDetail } = useSharedGuideDetailQuery(
    initialDetail.guide.ownerId,
    initialDetail,
  );
  const { guide, items, isOwnPreview } = data;

  const saveSpotMutation = useSaveSharedGuideSpotMutation(guide.ownerId);
  const leaveMutation = useLeaveSharedGuideMutation();

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [savingSpotId, setSavingSpotId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const cityBuckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const city = item.city?.trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [items]);

  const cuisineBuckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const raw of item.cuisines) {
        const clean = raw.trim();
        if (!clean || clean.toLowerCase() === "restaurant") continue;
        counts.set(clean, (counts.get(clean) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 12);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCity !== "All" && (item.city?.trim() ?? "") !== selectedCity) {
        return false;
      }
      if (
        selectedCuisine !== "All" &&
        !item.cuisines.some((c) => c.trim().toLowerCase() === selectedCuisine.toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.city?.toLowerCase().includes(q) ?? false) ||
        (item.address?.toLowerCase().includes(q) ?? false) ||
        item.cuisines.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [items, searchQuery, selectedCity, selectedCuisine]);

  async function handleSaveSpot(sourceRestaurantId: string, name: string) {
    setSavingSpotId(sourceRestaurantId);
    try {
      const result = await saveSpotMutation.mutateAsync(sourceRestaurantId);
      toast(result.created ? `Saved "${name}" to Places.` : `"${name}" is already in your Places.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save restaurant.");
    } finally {
      setSavingSpotId(null);
    }
  }

  async function handleLeaveGuide() {
    try {
      await leaveMutation.mutateAsync(guide.ownerId);
      toast(`Removed ${guide.ownerName}'s Shared Guide.`);
      router.push("/lists?tab=shared");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave shared guide.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/lists?tab=shared"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Shared Guides
        </Link>

        {!isOwnPreview ? (
          confirmLeave ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmLeave(false)}
                disabled={leaveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleLeaveGuide()}
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? "Leaving..." : "Yes, leave guide"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmLeave(true)}
              className="gap-1.5 text-muted hover:text-danger"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Leave guide
            </Button>
          )
        ) : null}
      </div>

      <header className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-2xs dark:border-[#413830]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
            <Lock className="size-3" aria-hidden="true" />
            Live · Read-only
          </span>
          {guide.ownerUsername ? (
            <span className="text-xs text-muted">by @{guide.ownerUsername}</span>
          ) : null}
        </div>

        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">
          {guide.ownerName}&apos;s Saved Places
        </h1>

        <p className="text-sm text-muted">
          Updates automatically whenever {guide.ownerName} adds spots. Tap Save on any restaurant to
          track it in your own library.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs font-medium text-muted tabular-nums">
            {items.length} {items.length === 1 ? "spot" : "spots"}
            {guide.citiesCount > 0
              ? ` across ${guide.citiesCount} ${guide.citiesCount === 1 ? "city" : "cities"}`
              : ""}
          </p>

          <div
            className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                viewMode === "list" ? "bg-ink text-bg" : "text-muted hover:text-ink",
              )}
            >
              <ListIcon className="size-3.5" aria-hidden="true" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                viewMode === "map" ? "bg-ink text-bg" : "text-muted hover:text-ink",
              )}
            >
              <MapIcon className="size-3.5" aria-hidden="true" />
              Map
            </button>
          </div>
        </div>
      </header>

      {items.length > 0 ? (
        <div className="space-y-3">
          <div className="relative">
            <Label htmlFor="shared-guide-search" className="sr-only">
              Search shared guide
            </Label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id="shared-guide-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurant name, city, or cuisine..."
              className="pl-10"
            />
          </div>

          {cityBuckets.length > 1 ? (
            <div
              className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              aria-label="Filter by city"
            >
              <button
                type="button"
                aria-pressed={selectedCity === "All"}
                onClick={() => setSelectedCity("All")}
                className={cn(
                  "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  selectedCity === "All"
                    ? "border-ink bg-ink text-bg"
                    : "border-border bg-surface text-muted hover:border-accent/45 hover:text-ink dark:border-[#413830]",
                )}
              >
                All cities ({items.length})
              </button>
              {cityBuckets.map((bucket) => {
                const active = selectedCity === bucket.label;
                return (
                  <button
                    key={bucket.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCity(bucket.label)}
                    className={cn(
                      "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-ink bg-ink text-bg"
                        : "border-border bg-surface text-muted hover:border-accent/45 hover:text-ink dark:border-[#413830]",
                    )}
                  >
                    {bucket.label} <span className="tabular-nums opacity-75">{bucket.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {cuisineBuckets.length > 1 ? (
            <div
              className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              aria-label="Filter by cuisine"
            >
              <button
                type="button"
                aria-pressed={selectedCuisine === "All"}
                onClick={() => setSelectedCuisine("All")}
                className={cn(
                  "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  selectedCuisine === "All"
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-border bg-surface text-muted hover:border-accent/45 hover:text-ink dark:border-[#413830]",
                )}
              >
                All cuisines
              </button>
              {cuisineBuckets.map((bucket) => {
                const active = selectedCuisine === bucket.label;
                return (
                  <button
                    key={bucket.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCuisine(bucket.label)}
                    className={cn(
                      "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border bg-surface text-muted hover:border-accent/45 hover:text-ink dark:border-[#413830]",
                    )}
                  >
                    {bucket.label} <span className="tabular-nums opacity-75">{bucket.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No spots saved yet"
          description={`${guide.ownerName} hasn't saved any spots yet — new additions will appear here automatically.`}
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No spots match your filter"
          description="Try clearing the city, cuisine, or search query."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCity("All");
                setSelectedCuisine("All");
                setSearchQuery("");
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : viewMode === "map" ? (
        <div className="space-y-3">
          <PublicListMap
            items={filteredItems}
            viewerSignedIn={!isOwnPreview}
            savingSpotId={savingSpotId}
            onSaveSpot={(id, name) => void handleSaveSpot(id, name)}
          />
          <ul className="space-y-2.5">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <Card className="flex items-center justify-between gap-3 dark:border-[#413830]">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base font-medium text-ink">
                      {item.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate">
                        {item.address ?? item.city ?? "Location verified"}
                      </span>
                    </p>
                  </div>
                  <a
                    href={buildMapsDirectionsUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-surface-elevated px-3 text-xs font-medium text-ink hover:border-accent/50"
                  >
                    Directions
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <SharedGuideSpotCard
              key={item.id}
              item={item}
              isOwnPreview={isOwnPreview}
              saving={savingSpotId === item.id}
              onSaveSpot={(id, name) => void handleSaveSpot(id, name)}
            />
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-[11px] text-muted">
        Spot locations and Google Maps links powered by Google.
      </p>
    </div>
  );
}
