"use client";

import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { CityInput } from "@/components/places/city-input";
import { CuisineTagEditor } from "@/components/places/cuisine-tag-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { StarRating, formatStars } from "@/components/ui/star-rating";
import { toast } from "@/components/ui/toast";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { normalizeFacetKey } from "@/lib/places/facets";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import {
  useDeleteRestaurantMutation,
  useRestaurantDetailQuery,
  useUpdateRestaurantMutation,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import {
  RESTAURANT_STATUSES,
  STATUS_LABELS,
  updateRestaurantSchema,
  type RestaurantStatus,
} from "@/lib/validation/places";

const STATUS_ACTIVE_STYLES: Record<RestaurantStatus, string> = {
  to_try: "border-to-try bg-to-try-bg text-to-try-ink",
  exploration: "border-exploration bg-exploration-bg text-exploration-ink",
  tried: "border-tried bg-tried-bg text-tried-ink",
};

function EditRestaurantSheet({
  restaurant,
  open,
  onOpenChange,
}: {
  restaurant: UserRestaurantItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(restaurant.name);
  const [city, setCity] = useState(restaurant.city ?? "");
  const [countryCode, setCountryCode] = useState(restaurant.countryCode ?? "");
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [cuisines, setCuisines] = useState<string[]>(restaurant.cuisines);
  const [priceLevel, setPriceLevel] = useState<number | null>(restaurant.priceLevel);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateRestaurantMutation();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = updateRestaurantSchema.safeParse({
      name,
      city: city.trim() ? city.trim() : null,
      countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null,
      address: address.trim() ? address.trim() : null,
      cuisines,
      priceLevel,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the details and try again.");
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: restaurant.id, data: parsed.data });
      toast("Spot details updated");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>Edit spot details</SheetTitle>
          <SheetDescription>Update name, city, cuisines, price, or address.</SheetDescription>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pb-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-spot-name">Restaurant name</Label>
            <Input
              id="edit-spot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <CityInput id="edit-spot-city" value={city} onChange={setCity} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-spot-country">Country</Label>
              <Input
                id="edit-spot-country"
                value={countryCode}
                maxLength={8}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                placeholder="US"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Price range</Label>
              <span className="text-xs text-muted">
                {priceLevel ? formatPriceLevel(priceLevel) : "Optional"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((level) => {
                const active = priceLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPriceLevel((prev) => (prev === level ? null : level))}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-xl border text-sm font-medium transition-colors",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border bg-surface text-muted hover:text-ink",
                    )}
                  >
                    {"$".repeat(level)}
                  </button>
                );
              })}
            </div>
          </div>

          <CuisineTagEditor id="edit-spot-cuisine" value={cuisines} onChange={setCuisines} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-spot-address">Address</Label>
            <Input
              id="edit-spot-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-1 bg-surface pt-2 pb-1">
            <Button type="submit" size="lg" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function RestaurantDetail({ initialRestaurant }: { initialRestaurant: UserRestaurantItem }) {
  const router = useRouter();
  const { data: restaurant = initialRestaurant } = useRestaurantDetailQuery(
    initialRestaurant.id,
    initialRestaurant,
  );
  const updateMutation = useUpdateRestaurantMutation();
  const deleteMutation = useDeleteRestaurantMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const effectiveNotes = notesDraft ?? restaurant.notes ?? "";
  const notesDirty = notesDraft !== null && notesDraft !== (restaurant.notes ?? "");

  const visibleCuisines = restaurant.cuisines.filter(
    (c) => c.trim().toLowerCase() !== "restaurant",
  );
  const priceLabel = formatPriceLevel(restaurant.priceLevel);

  async function handleStatusChange(nextStatus: RestaurantStatus) {
    if (nextStatus === restaurant.status) return;
    try {
      await updateMutation.mutateAsync({
        id: restaurant.id,
        data: { status: nextStatus },
      });
      toast(`Moved to ${STATUS_LABELS[nextStatus]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status.");
    }
  }

  async function handleRatingChange(nextHalf: number | null) {
    try {
      await updateMutation.mutateAsync({
        id: restaurant.id,
        data: { ratingHalf: nextHalf },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save rating.");
    }
  }

  async function handleSaveNotes(event?: FormEvent) {
    event?.preventDefault();
    const cleaned = effectiveNotes.trim() ? effectiveNotes.trim() : null;
    try {
      await updateMutation.mutateAsync({
        id: restaurant.id,
        data: { notes: cleaned },
      });
      setNotesDraft(null);
      toast("Tasting notes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save notes.");
    }
  }

  async function handleDeleteSpot() {
    try {
      await deleteMutation.mutateAsync(restaurant.id);
      toast(`Removed ${restaurant.name}`);
      router.replace("/places");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove spot.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/places"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Places
        </Link>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="gap-1.5"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
      </div>

      {/* Hero Summary Card */}
      <Card className="space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-surface-elevated text-accent">
            <FoodIcon name={mapCuisinesToFoodIcon(restaurant.cuisines)} className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-ink sm:text-3xl">
              {restaurant.name}
            </h1>
            {restaurant.address ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{restaurant.address}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Clickable City, Cuisine & Price Facet Links */}
        <div className="flex flex-wrap items-center gap-2">
          {restaurant.city ? (
            <Link
              href={`/places?city=${encodeURIComponent(normalizeFacetKey(restaurant.city))}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 text-sm font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              <MapPin className="size-3.5 text-accent" aria-hidden="true" />
              <span>
                {restaurant.city}
                {restaurant.countryCode ? `, ${restaurant.countryCode}` : ""}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted hover:text-ink"
            >
              + Add city
            </button>
          )}

          {visibleCuisines.map((tag) => (
            <Link
              key={tag}
              href={`/places?cuisine=${encodeURIComponent(normalizeFacetKey(tag))}`}
              className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink"
            >
              {tag}
            </Link>
          ))}

          {priceLabel ? (
            <span className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-3 text-sm font-medium text-ink">
              {priceLabel}
            </span>
          ) : null}
        </div>

        {/* Google Maps & Directions Actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <a
            href={buildMapsPlaceUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open in Maps
          </a>
          <a
            href={buildMapsDirectionsUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Navigation className="size-4" aria-hidden="true" />
            Directions
          </a>
        </div>
      </Card>

      {/* Quick Status & Rating */}
      <Card className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <div role="radiogroup" aria-label="Restaurant status" className="grid grid-cols-3 gap-2">
            {RESTAURANT_STATUSES.map((option) => {
              const active = restaurant.status === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void handleStatusChange(option)}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? STATUS_ACTIVE_STYLES[option]
                      : "border-border bg-surface text-muted hover:text-ink",
                  )}
                >
                  {STATUS_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Your rating</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{formatStars(restaurant.ratingHalf)}</span>
              {restaurant.ratingHalf !== null ? (
                <button
                  type="button"
                  onClick={() => void handleRatingChange(null)}
                  className="cursor-pointer text-xs font-medium text-accent hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <StarRating
            value={restaurant.ratingHalf}
            onChange={(val) => void handleRatingChange(val)}
            size="lg"
            label={`${restaurant.name} rating`}
          />
        </div>
      </Card>

      {/* Tasting Notes */}
      <Card>
        <form onSubmit={(e) => void handleSaveNotes(e)} className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="detail-tasting-notes">Tasting notes</Label>
            {notesDirty ? (
              <span className="text-xs font-medium text-accent">Unsaved changes</span>
            ) : null}
          </div>
          <textarea
            id="detail-tasting-notes"
            rows={4}
            value={effectiveNotes}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Who recommended it, best seat, dishes to order next time..."
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
          />
          {notesDirty ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNotesDraft(null)}>
                Discard
              </Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                Save notes
              </Button>
            </div>
          ) : null}
        </form>
      </Card>

      {/* Visits Summary (Ready for Phase 4) */}
      <Card className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface-elevated text-accent">
            <Calendar className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">
              {restaurant.visitCount === 0
                ? "No visits logged yet"
                : `${restaurant.visitCount} ${restaurant.visitCount === 1 ? "visit" : "visits"} logged`}
            </p>
            <p className="text-xs text-muted">
              {restaurant.lastVisitedOn
                ? `Last visited ${restaurant.lastVisitedOn}`
                : "Visit history & dishes arrive in Phase 4."}
            </p>
          </div>
        </div>
      </Card>

      {/* Remove Spot */}
      <div className="pt-2">
        {!confirmDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full gap-2 text-danger hover:bg-danger/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove spot from library
          </Button>
        ) : (
          <Card className="space-y-3 border-danger/35 bg-danger/5">
            <p className="text-sm font-medium text-ink">
              Remove <span className="font-semibold">{restaurant.name}</span> from your library?
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => void handleDeleteSpot()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Removing..." : "Yes, remove"}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {editOpen ? (
        <EditRestaurantSheet
          key={`${restaurant.id}-${restaurant.updatedAt}`}
          restaurant={restaurant}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </div>
  );
}
