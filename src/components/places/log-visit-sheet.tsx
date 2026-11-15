"use client";

import { Plus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { StarRating, formatStars } from "@/components/ui/star-rating";
import { toast } from "@/components/ui/toast";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import {
  useCreateVisitMutation,
  useUpdateVisitMutation,
  type VisitItem,
} from "@/lib/queries/visits";
import { cn } from "@/lib/utils";
import { createVisitSchema, getLocalIsoDate } from "@/lib/validation/visits";

interface DishDraft {
  localId: string;
  name: string;
  note: string;
  wouldOrderAgain: boolean | null;
}

function buildInitialDishes(visit: VisitItem | null | undefined): DishDraft[] {
  if (!visit) return [];
  return visit.dishes.map((dish, idx) => ({
    localId: dish.id || `dish-${idx}`,
    name: dish.name,
    note: dish.note ?? "",
    wouldOrderAgain: dish.wouldOrderAgain,
  }));
}

export function LogVisitSheet({
  restaurant,
  visit = null,
  open,
  onOpenChange,
}: {
  restaurant: UserRestaurantItem;
  visit?: VisitItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = Boolean(visit);
  const createMutation = useCreateVisitMutation(restaurant.id);
  const updateMutation = useUpdateVisitMutation(restaurant.id);

  const todayIso = getLocalIsoDate(0);
  const yesterdayIso = getLocalIsoDate(-1);

  const [visitedOn, setVisitedOn] = useState(visit?.visitedOn ?? todayIso);
  const [ratingHalf, setRatingHalf] = useState<number | null>(visit?.ratingHalf ?? null);
  const [notes, setNotes] = useState(visit?.notes ?? "");
  const [dishes, setDishes] = useState<DishDraft[]>(() => buildInitialDishes(visit));
  const [dishInput, setDishInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dishInputRef = useRef<HTMLInputElement>(null);
  const dishCounterRef = useRef(dishes.length + 1);
  const isPending = createMutation.isPending || updateMutation.isPending;

  function appendDishFromInput() {
    const trimmed = dishInput.trim();
    if (!trimmed) return;
    if (dishes.length >= 40) {
      setError("Keep up to 40 dishes per visit.");
      return;
    }

    const nextId = `draft-${dishCounterRef.current++}`;
    setDishes((prev) => [
      ...prev,
      {
        localId: nextId,
        name: trimmed.slice(0, 120),
        note: "",
        wouldOrderAgain: true,
      },
    ]);
    setDishInput("");
    setError(null);
    dishInputRef.current?.focus();
  }

  function handleDishKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      appendDishFromInput();
    }
  }

  function updateDish(localId: string, patch: Partial<DishDraft>) {
    setDishes((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  }

  function toggleWouldOrderAgain(localId: string, target: boolean) {
    setDishes((prev) =>
      prev.map((d) => {
        if (d.localId !== localId) return d;
        return { ...d, wouldOrderAgain: d.wouldOrderAgain === target ? null : target };
      }),
    );
  }

  function removeDish(localId: string) {
    setDishes((prev) => prev.filter((d) => d.localId !== localId));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isPending) return;
    setError(null);

    const pendingDish = dishInput.trim();
    const allDishes = pendingDish
      ? [
          ...dishes,
          {
            localId: `draft-${dishCounterRef.current++}`,
            name: pendingDish.slice(0, 120),
            note: "",
            wouldOrderAgain: true as boolean | null,
          },
        ]
      : dishes;

    const payload = {
      visitedOn,
      ratingHalf,
      notes: notes.trim() ? notes.trim() : null,
      dishes: allDishes.map((d) => ({
        name: d.name.trim(),
        note: d.note.trim() ? d.note.trim() : null,
        wouldOrderAgain: d.wouldOrderAgain,
      })),
    };

    const parsed = createVisitSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the visit details.");
      return;
    }

    try {
      if (isEditing && visit) {
        await updateMutation.mutateAsync({
          visitId: visit.id,
          data: parsed.data,
        });
        toast("Visit updated");
      } else {
        const result = await createMutation.mutateAsync(parsed.data);
        const promotedToTried =
          restaurant.status !== "tried" && result.restaurant.status === "tried";
        toast(promotedToTried ? "Visit logged · Moved to Tried" : "Visit logged");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save visit.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>{isEditing ? "Edit visit" : `Log visit · ${restaurant.name}`}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update when you went, your visit rating, or what you ordered."
              : "Track when you went, what you ordered, and what you would get again."}
          </SheetDescription>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 pb-3">
          {/* Date */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="visit-date-input">Visit date</Label>
              <div className="flex items-center gap-1.5">
                {[
                  { label: "Today", value: todayIso },
                  { label: "Yesterday", value: yesterdayIso },
                ].map((preset) => {
                  const active = visitedOn === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setVisitedOn(preset.value)}
                      className={cn(
                        "inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors",
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-border bg-surface text-muted hover:text-ink",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              id="visit-date-input"
              type="date"
              value={visitedOn}
              onChange={(e) => setVisitedOn(e.target.value)}
              required
            />
          </div>

          {/* Visit Rating */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Visit rating</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{formatStars(ratingHalf)}</span>
                {ratingHalf !== null ? (
                  <button
                    type="button"
                    onClick={() => setRatingHalf(null)}
                    className="cursor-pointer text-xs font-medium text-accent hover:underline"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <StarRating
              value={ratingHalf}
              onChange={setRatingHalf}
              size="lg"
              label={`${restaurant.name} visit rating`}
            />
          </div>

          {/* Rapid Dish Entry */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="visit-dish-input">What you ordered</Label>
              <span className="text-xs text-muted tabular-nums">{dishes.length} dishes</span>
            </div>

            <div className="flex gap-2">
              <Input
                ref={dishInputRef}
                id="visit-dish-input"
                value={dishInput}
                onChange={(e) => setDishInput(e.target.value)}
                onKeyDown={handleDishKeyDown}
                placeholder="Type a dish & press Enter..."
                aria-label="Dish name"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={appendDishFromInput}
                disabled={!dishInput.trim()}
                aria-label="Add dish"
                className="shrink-0 gap-1"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>

            {dishes.length > 0 ? (
              <ul className="space-y-2.5" aria-label="Ordered dishes">
                {dishes.map((dish) => (
                  <li
                    key={dish.localId}
                    className="space-y-2 rounded-xl border border-border bg-surface-elevated/60 p-3 dark:bg-[#191512]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {dish.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDish(dish.localId)}
                        aria-label={`Remove ${dish.name}`}
                        className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-danger"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        aria-pressed={dish.wouldOrderAgain === true}
                        onClick={() => toggleWouldOrderAgain(dish.localId, true)}
                        className={cn(
                          "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                          dish.wouldOrderAgain === true
                            ? "border-tried bg-tried-bg text-tried-ink"
                            : "border-border bg-surface text-muted hover:text-ink",
                        )}
                      >
                        <ThumbsUp className="size-3.5" aria-hidden="true" />
                        Order again
                      </button>

                      <button
                        type="button"
                        aria-pressed={dish.wouldOrderAgain === false}
                        onClick={() => toggleWouldOrderAgain(dish.localId, false)}
                        className={cn(
                          "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                          dish.wouldOrderAgain === false
                            ? "border-danger/50 bg-danger/10 text-danger"
                            : "border-border bg-surface text-muted hover:text-ink",
                        )}
                      >
                        <ThumbsDown className="size-3.5" aria-hidden="true" />
                        Skip next time
                      </button>
                    </div>

                    <Input
                      value={dish.note}
                      onChange={(e) => updateDish(dish.localId, { note: e.target.value })}
                      placeholder="Short dish note (optional)"
                      aria-label={`Note for ${dish.name}`}
                      maxLength={300}
                      className="h-9 bg-surface text-base sm:text-sm"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Visit Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="visit-notes-input">Visit notes</Label>
            <textarea
              id="visit-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Atmosphere, table vibe, service, or who you went with..."
              maxLength={2000}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
            />
          </div>

          {!isEditing &&
          restaurant.visitCount === 0 &&
          (restaurant.status === "to_try" || restaurant.status === "exploration") ? (
            <p className="rounded-xl border border-tried/35 bg-tried-bg/60 px-3 py-2 text-xs text-tried-ink">
              Logging your first visit automatically moves this spot to Tried.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-1 bg-surface pt-2 pb-1">
            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save visit" : "Log visit"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
