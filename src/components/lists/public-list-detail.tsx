"use client";

import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Copy,
  ExternalLink,
  Globe,
  List as ListIcon,
  Map as MapIcon,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import {
  useClonePublicListMutation,
  usePublicListDetailQuery,
  useSavePublicSpotMutation,
  type PublicListDetailResponse,
  type PublicListRestaurantEntry,
} from "@/lib/queries/lists";
import { cn } from "@/lib/utils";

const PREFERRED_CUISINE_ORDER = ["Asian", "Indian", "Mexican", "Ramen", "Pizza"];

const PublicListMap = dynamic(
  () => import("@/components/lists/public-list-map").then((mod) => mod.PublicListMap),
  { ssr: false },
);

function getPrimaryCuisine(cuisines: string[]): string {
  const nonMeta = cuisines.filter((c) => c.toLowerCase() !== "vegetarian-friendly");
  return nonMeta[0] ?? cuisines[0] ?? "Other";
}

function PublicSpotCard({
  item,
  viewerSignedIn,
  signInHref,
  saving,
  onSaveSpot,
}: {
  item: PublicListRestaurantEntry;
  viewerSignedIn: boolean;
  signInHref: string;
  saving: boolean;
  onSaveSpot: (sourceRestaurantId: string, name: string) => void;
}) {
  const iconKey = mapCuisinesToFoodIcon(item.cuisines);
  const priceLabel = formatPriceLevel(item.priceLevel);
  const visibleCuisines = item.cuisines.slice(0, 3);

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

          {item.curatorNote ? (
            <p className="text-xs italic text-muted">{item.curatorNote}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        {viewerSignedIn ? (
          item.savedByViewer ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Check className="size-3.5" aria-hidden="true" />
                Saved
              </span>
              {item.viewerRestaurantId ? (
                <Link
                  href={`/places/${item.viewerRestaurantId}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-medium text-ink hover:border-accent/50"
                >
                  Open
                </Link>
              ) : null}
            </div>
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
              {saving ? "Saving..." : "+ Save"}
            </Button>
          )
        ) : (
          <Link
            href={signInHref}
            className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface-elevated px-3 text-xs font-medium text-ink hover:border-accent/50"
          >
            Sign in to save
          </Link>
        )}

        <a
          href={buildMapsPlaceUrl(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-accent hover:underline"
        >
          Maps
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}

export function PublicListDetail({
  initialDetail,
  viewerSignedIn,
  backHref,
  backLabel,
}: {
  initialDetail: PublicListDetailResponse;
  viewerSignedIn: boolean;
  backHref: string;
  backLabel: string;
}) {
  const slug = initialDetail.list.publicSlug;
  const { data = initialDetail } = usePublicListDetailQuery(slug, initialDetail);
  const list = data?.list ?? initialDetail.list;
  const items = data?.items ?? initialDetail.items;

  const saveSpotMutation = useSavePublicSpotMutation(slug);
  const cloneMutation = useClonePublicListMutation(slug);

  const [savingSpotId, setSavingSpotId] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"spots" | "map">("spots");
  const [copiedLink, setCopiedLink] = useState(false);

  const signInHref = `/signin?next=${encodeURIComponent(`/s/${slug}`)}`;
  const joinHref = `/join?next=${encodeURIComponent(`/s/${slug}`)}`;

  const cuisineBuckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const primary = getPrimaryCuisine(item.cuisines);
      counts.set(primary, (counts.get(primary) ?? 0) + 1);
    }

    const ordered: Array<{ label: string; count: number }> = [];
    for (const preferred of PREFERRED_CUISINE_ORDER) {
      const count = counts.get(preferred);
      if (count) {
        ordered.push({ label: preferred, count });
        counts.delete(preferred);
      }
    }
    for (const [label, count] of Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      ordered.push({ label, count });
    }
    return ordered;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCuisine !== "All") {
        const primary = getPrimaryCuisine(item.cuisines);
        const matchesCuisine =
          primary.toLowerCase() === selectedCuisine.toLowerCase() ||
          item.cuisines.some((c) => c.toLowerCase() === selectedCuisine.toLowerCase());
        if (!matchesCuisine) return false;
      }
      if (!q) return true;
      const haystack = [
        item.name,
        item.address ?? "",
        item.city ?? "",
        ...item.cuisines,
        item.curatorNote ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, searchQuery, selectedCuisine]);

  const shouldGroupByCuisine =
    viewMode === "spots" &&
    selectedCuisine === "All" &&
    !searchQuery.trim() &&
    cuisineBuckets.length > 1;

  const groupedSections = useMemo(() => {
    if (!shouldGroupByCuisine) return [];
    const byCuisine = new Map<string, PublicListRestaurantEntry[]>();
    for (const bucket of cuisineBuckets) {
      byCuisine.set(bucket.label, []);
    }
    for (const item of filteredItems) {
      const primary = getPrimaryCuisine(item.cuisines);
      const listForCuisine = byCuisine.get(primary) ?? [];
      listForCuisine.push(item);
      byCuisine.set(primary, listForCuisine);
    }
    return Array.from(byCuisine.entries()).filter(([, entries]) => entries.length > 0);
  }, [shouldGroupByCuisine, cuisineBuckets, filteredItems]);

  async function handleSaveSpot(sourceRestaurantId: string, name: string) {
    setSavingSpotId(sourceRestaurantId);
    try {
      const res = await saveSpotMutation.mutateAsync(sourceRestaurantId);
      toast(res.created ? `Saved ${name} to Places` : `${name} is already in Places`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save spot.");
    } finally {
      setSavingSpotId(null);
    }
  }

  async function handleCloneList() {
    try {
      const res = await cloneMutation.mutateAsync({});
      toast(
        res.addedRestaurantsCount > 0
          ? `Saved "${res.list.name}" + ${res.addedRestaurantsCount} new ${res.addedRestaurantsCount === 1 ? "spot" : "spots"} to My Lists`
          : `Saved "${res.list.name}" to My Lists`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save list.");
    }
  }

  async function handleCopyShareLink() {
    const shareUrl = `${window.location.origin}/s/${slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast("Share link copied");
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error(`Share link: /s/${slug}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopyShareLink()}
          className="gap-1.5"
        >
          {copiedLink ? (
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copiedLink ? "Copied" : "Copy link"}
        </Button>
      </div>

      <Card className="space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-elevated text-accent">
            <FoodIcon name={list.icon} className="size-6" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {list.isFeatured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Curated Guide
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  <Globe className="size-3" aria-hidden="true" />
                  Public List
                </span>
              )}
              {list.city ? (
                <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {list.city}
                </span>
              ) : null}
            </div>

            <h1 className="font-serif text-2xl font-medium tracking-tight text-ink sm:text-3xl">
              {list.name}
            </h1>

            {list.description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{list.description}</p>
            ) : null}

            <p className="mt-2 text-xs font-medium text-muted tabular-nums">
              Curated by {list.curatorUsername ? `@${list.curatorUsername}` : list.curatorName} ·{" "}
              {items.length} {items.length === 1 ? "spot" : "spots"}
              {list.copyCount > 0 ? ` · ${list.copyCount} saved` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-border/70 pt-3.5">
          {viewerSignedIn ? (
            list.savedCopyListId ? (
              <>
                <Link
                  href={`/lists/${list.savedCopyListId}`}
                  className={cn(buttonVariants({ variant: "primary", size: "md" }), "gap-1.5")}
                >
                  <Check className="size-4" aria-hidden="true" />
                  Open in My Lists
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={cloneMutation.isPending}
                  onClick={() => void handleCloneList()}
                >
                  {cloneMutation.isPending ? "Saving..." : "Save another copy"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="md"
                disabled={cloneMutation.isPending || items.length === 0}
                onClick={() => void handleCloneList()}
                className="gap-1.5"
              >
                <BookmarkPlus className="size-4" aria-hidden="true" />
                {cloneMutation.isPending ? "Saving entire list..." : "Save entire list"}
              </Button>
            )
          ) : (
            <>
              <Link
                href={signInHref}
                className={cn(buttonVariants({ variant: "primary", size: "md" }))}
              >
                Sign in to save spots
              </Link>
              <Link
                href={joinHref}
                className={cn(buttonVariants({ variant: "outline", size: "md" }))}
              >
                Create free account
              </Link>
            </>
          )}
        </div>
      </Card>

      {items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Label htmlFor="public-list-spot-search" className="sr-only">
                Search spots in this list
              </Label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <Input
                id="public-list-spot-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurants in this list..."
                className="pl-10"
              />
            </div>

            <div className="inline-flex w-fit rounded-full border border-border bg-surface-elevated p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === "spots"}
                onClick={() => setViewMode("spots")}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
                  viewMode === "spots" ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
                )}
              >
                <ListIcon className="size-3.5" aria-hidden="true" />
                Spots
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "map"}
                onClick={() => setViewMode("map")}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
                  viewMode === "map" ? "bg-ink text-bg shadow-2xs" : "text-muted hover:text-ink",
                )}
              >
                <MapIcon className="size-3.5" aria-hidden="true" />
                Map
              </button>
            </div>
          </div>

          {cuisineBuckets.length > 1 ? (
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter spots by cuisine"
            >
              <button
                type="button"
                aria-pressed={selectedCuisine === "All"}
                onClick={() => setSelectedCuisine("All")}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  selectedCuisine === "All"
                    ? "border-ink bg-ink text-bg"
                    : "border-border bg-surface text-muted hover:border-accent/45 hover:text-ink dark:border-[#413830]",
                )}
              >
                All <span className="tabular-nums opacity-75">{items.length}</span>
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
                      "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
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
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="This public list has no spots yet"
          description="Check back later or browse other curated guides."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No spots match your filter"
          description="Try another cuisine filter or clear your search."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
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
            viewerSignedIn={viewerSignedIn}
            savingSpotId={savingSpotId}
            onSaveSpot={(id, name) => void handleSaveSpot(id, name)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated/55 px-4 py-3 dark:bg-[#191512]">
            <p className="text-xs text-muted">
              Open directions for any spot in Google Maps, or save the list to plot pins on your
              personal Resker map.
            </p>
            {viewerSignedIn && list.savedCopyListId ? (
              <Link
                href={`/map?list=${list.savedCopyListId}`}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-medium text-accent-ink shadow-2xs"
              >
                <MapIcon className="size-3.5" aria-hidden="true" />
                Open interactive map
              </Link>
            ) : null}
          </div>

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
      ) : shouldGroupByCuisine ? (
        <div className="space-y-6">
          {groupedSections.map(([cuisine, entries]) => (
            <section key={cuisine} aria-label={`${cuisine} picks`} className="space-y-2.5">
              <div className="flex items-center justify-between border-l-3 border-accent pl-3">
                <h2 className="font-serif text-xl font-medium tracking-tight text-ink">
                  {cuisine}
                </h2>
                <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-muted tabular-nums">
                  {entries.length} {entries.length === 1 ? "spot" : "spots"}
                </span>
              </div>
              <div className="space-y-2.5">
                {entries.map((item) => (
                  <PublicSpotCard
                    key={item.id}
                    item={item}
                    viewerSignedIn={viewerSignedIn}
                    signInHref={signInHref}
                    saving={savingSpotId === item.id}
                    onSaveSpot={(id, name) => void handleSaveSpot(id, name)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <PublicSpotCard
              key={item.id}
              item={item}
              viewerSignedIn={viewerSignedIn}
              signInHref={signInHref}
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
