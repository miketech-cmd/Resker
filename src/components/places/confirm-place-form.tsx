"use client";

import { ArrowLeft, MapPin, Plus, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StarRating, formatStars } from "@/components/ui/star-rating";
import { showSavedToast, toast } from "@/components/ui/toast";
import {
  QUICK_CUISINE_SUGGESTIONS,
  formatPriceLevel,
  mapCuisinesToFoodIcon,
} from "@/lib/places/cuisines";
import {
  useSaveRestaurantMutation,
  type PlacePrefillData,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import {
  RESTAURANT_STATUSES,
  STATUS_LABELS,
  createRestaurantSchema,
  type RestaurantStatus,
} from "@/lib/validation/places";

const STATUS_ACTIVE_STYLES: Record<RestaurantStatus, string> = {
  to_try: "border-to-try bg-to-try-bg text-to-try-ink",
  exploration: "border-exploration bg-exploration-bg text-exploration-ink",
  tried: "border-tried bg-tried-bg text-tried-ink",
};

export function ConfirmPlaceForm({
  prefill,
  onBack,
  onSaved,
}: {
  prefill: PlacePrefillData;
  onBack: () => void;
  onSaved: (restaurant: UserRestaurantItem) => void;
}) {
  const [name, setName] = useState(prefill.name);
  const [address, setAddress] = useState(prefill.address ?? "");
  const [cuisines, setCuisines] = useState<string[]>(prefill.cuisines);
  const [customCuisine, setCustomCuisine] = useState("");
  const [priceLevel, setPriceLevel] = useState<number | null>(prefill.priceLevel);
  const [status, setStatus] = useState<RestaurantStatus>("to_try");
  const [ratingHalf, setRatingHalf] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const saveMutation = useSaveRestaurantMutation();
  const iconKey = mapCuisinesToFoodIcon(cuisines);

  function addCuisineTag(rawTag: string) {
    const clean = rawTag.trim();
    if (!clean) return;
    setCuisines((prev) => {
      if (prev.some((c) => c.toLowerCase() === clean.toLowerCase())) return prev;
      if (prev.length >= 6) return prev;
      return [...prev, clean];
    });
    setCustomCuisine("");
  }

  function removeCuisineTag(tag: string) {
    setCuisines((prev) => prev.filter((c) => c !== tag));
  }

  function handleCustomCuisineKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCuisineTag(customCuisine);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);

    const parsed = createRestaurantSchema.safeParse({
      googlePlaceId: prefill.googlePlaceId,
      googleMapsUri: prefill.googleMapsUri,
      lat: prefill.lat,
      lng: prefill.lng,
      name,
      address: address.trim() ? address.trim() : null,
      city: prefill.city,
      countryCode: prefill.countryCode,
      cuisines,
      priceLevel,
      status,
      ratingHalf,
      notes: notes.trim() ? notes.trim() : null,
    });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Please check the form fields.");
      return;
    }

    try {
      const result = await saveMutation.mutateAsync(parsed.data);
      if (result.created) {
        showSavedToast(STATUS_LABELS[parsed.data.status]);
      } else {
        toast("Already saved in your library");
      }
      onSaved(result.restaurant);
    } catch (error) {
      setFieldError(
        error instanceof Error ? error.message : "Could not save restaurant. Please try again.",
      );
    }
  }

  const availableSuggestions = QUICK_CUISINE_SUGGESTIONS.filter(
    (s) => !cuisines.some((c) => c.toLowerCase() === s.toLowerCase()),
  ).slice(0, 6);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Change spot
        </button>

        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <MapPin className="size-3.5" aria-hidden="true" />
          Google Maps
        </span>
      </div>

      {/* Restaurant summary banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface-elevated/60 p-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent shadow-2xs">
          <FoodIcon name={iconKey} className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <Label htmlFor="confirm-place-name" className="sr-only">
              Restaurant name
            </Label>
            <Input
              id="confirm-place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Restaurant name"
              className="font-serif text-lg font-medium"
              required
            />
          </div>
          {prefill.city ? (
            <p className="text-xs text-muted">
              {prefill.city}
              {prefill.countryCode ? `, ${prefill.countryCode}` : ""}
              {priceLevel ? ` · ${formatPriceLevel(priceLevel)}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {/* Status Selector */}
      <div className="space-y-2">
        <Label>Status</Label>
        <div role="radiogroup" aria-label="Restaurant status" className="grid grid-cols-3 gap-2">
          {RESTAURANT_STATUSES.map((option) => {
            const active = status === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(option)}
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

      {/* Price Level */}
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
                  "min-h-11 cursor-pointer rounded-xl border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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

      {/* Cuisine Tags */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="confirm-custom-cuisine">Cuisines</Label>
          <span className="text-xs text-muted">{cuisines.length}/6</span>
        </div>

        {cuisines.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {cuisines.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeCuisineTag(tag)}
                aria-label={`Remove ${tag}`}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 text-sm font-medium text-ink hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span>{tag}</span>
                <X className="size-3.5 text-muted" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        {cuisines.length < 6 ? (
          <>
            <div className="flex gap-2">
              <Input
                id="confirm-custom-cuisine"
                value={customCuisine}
                onChange={(e) => setCustomCuisine(e.target.value)}
                onKeyDown={handleCustomCuisineKeyDown}
                placeholder="Add cuisine tag (e.g. Ramen)"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => addCuisineTag(customCuisine)}
                disabled={!customCuisine.trim()}
                aria-label="Add cuisine tag"
              >
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {availableSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {availableSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => addCuisineTag(suggestion)}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:border-ink/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Optional Rating */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Rating (optional)</Label>
          <span className="text-xs text-muted">{formatStars(ratingHalf)}</span>
        </div>
        <StarRating value={ratingHalf} onChange={setRatingHalf} size="lg" />
      </div>

      {/* Editable Address */}
      <div className="space-y-1.5">
        <Label htmlFor="confirm-place-address">Address</Label>
        <Input
          id="confirm-place-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
        />
      </div>

      {/* Tasting notes */}
      <div className="space-y-1.5">
        <Label htmlFor="confirm-place-notes">Tasting notes</Label>
        <textarea
          id="confirm-place-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Who recommended it, must-order dishes, best time to go..."
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        />
      </div>

      {fieldError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          {fieldError}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-1 bg-surface pt-2 pb-1">
        <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : `Save to ${STATUS_LABELS[status]}`}
        </Button>
      </div>
    </form>
  );
}
