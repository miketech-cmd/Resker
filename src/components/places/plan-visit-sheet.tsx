"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import {
  useCreatePlanMutation,
  useUpdatePlanMutation,
  type PlannedVisitItem,
} from "@/lib/queries/plans";
import { useRestaurantsQuery, type UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { createPlanSchema, normalizePlanTime } from "@/lib/validation/plans";
import { getLocalIsoDate } from "@/lib/validation/visits";

interface DatePreset {
  label: string;
  value: string;
}

function getNextWeekdayIso(targetDay: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  const delta = (targetDay - currentDay + 7) % 7 || 7;
  return getLocalIsoDate(delta);
}

function buildDatePresets(): DatePreset[] {
  const candidates: DatePreset[] = [
    { label: "Today", value: getLocalIsoDate(0) },
    { label: "Tomorrow", value: getLocalIsoDate(1) },
    { label: "Fri", value: getNextWeekdayIso(5) },
    { label: "Sat", value: getNextWeekdayIso(6) },
  ];

  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}

export function PlanVisitSheet({
  restaurant = null,
  restaurants: providedRestaurants,
  plan = null,
  open,
  onOpenChange,
  onSaved,
}: {
  restaurant?: Pick<UserRestaurantItem, "id" | "name" | "city"> | null;
  restaurants?: UserRestaurantItem[];
  plan?: PlannedVisitItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (plan: PlannedVisitItem) => void;
}) {
  const isEditing = Boolean(plan);
  const needsSelector = !restaurant && !plan;

  const { data: fetchedRestaurants = [] } = useRestaurantsQuery(providedRestaurants);
  const availableRestaurants = providedRestaurants ?? fetchedRestaurants;

  const createMutation = useCreatePlanMutation();
  const updateMutation = useUpdatePlanMutation();

  const defaultDate = plan?.plannedFor ?? getLocalIsoDate(1);
  const defaultRestaurantId =
    restaurant?.id ?? plan?.userRestaurantId ?? availableRestaurants[0]?.id ?? "";

  const [selectedRestaurantId, setSelectedRestaurantId] = useState(defaultRestaurantId);
  const [plannedFor, setPlannedFor] = useState(defaultDate);
  const [plannedTime, setPlannedTime] = useState(normalizePlanTime(plan?.plannedTime) ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const datePresets = buildDatePresets();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const activeRestaurantId = restaurant?.id ?? plan?.userRestaurantId ?? selectedRestaurantId;
  const activeRestaurantName =
    restaurant?.name ??
    plan?.restaurant.name ??
    availableRestaurants.find((r) => r.id === activeRestaurantId)?.name ??
    "this spot";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedTime = plannedTime.trim() ? plannedTime.trim() : null;
    const normalizedNote = note.trim() ? note.trim() : null;

    try {
      if (isEditing && plan) {
        const updated = await updateMutation.mutateAsync({
          id: plan.id,
          input: {
            plannedFor,
            plannedTime: normalizedTime,
            note: normalizedNote,
            ...(plan.status === "cancelled" ? { status: "planned" as const } : {}),
          },
        });
        toast("Reservation updated");
        onSaved?.(updated);
        onOpenChange(false);
        return;
      }

      const parsed = createPlanSchema.safeParse({
        userRestaurantId: activeRestaurantId,
        plannedFor,
        plannedTime: normalizedTime,
        note: normalizedNote,
      });

      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Please check the reservation details.");
        return;
      }

      const created = await createMutation.mutateAsync(parsed.data);
      toast(`Planned visit to ${created.restaurant.name}`);
      onSaved?.(created);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save planned visit.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="space-y-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <CalendarPlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <SheetTitle>{isEditing ? "Edit reservation" : "Plan a visit"}</SheetTitle>
              <SheetDescription>
                {needsSelector
                  ? "Pick a saved spot, date, and optional reservation time."
                  : `Schedule a table or reminder for ${activeRestaurantName}.`}
              </SheetDescription>
            </div>
          </div>

          {needsSelector && availableRestaurants.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border bg-surface-elevated p-4 text-center">
              <p className="text-sm text-muted">
                Save a restaurant to your library first before scheduling a visit.
              </p>
              <Link href="/places" className={buttonVariants({ size: "sm" })}>
                Go to Places
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {needsSelector ? (
                <div className="space-y-2">
                  <Label htmlFor="plan-restaurant-select">Restaurant</Label>
                  <select
                    id="plan-restaurant-select"
                    value={activeRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    required
                    className="min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
                  >
                    <option value="" disabled>
                      Select a saved spot...
                    </option>
                    {availableRestaurants.map((spot) => (
                      <option key={spot.id} value={spot.id}>
                        {spot.city ? `${spot.name} (${spot.city})` : spot.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="plan-date-input">Date</Label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {datePresets.map((preset) => {
                      const active = plannedFor === preset.value;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setPlannedFor(preset.value)}
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
                  id="plan-date-input"
                  type="date"
                  value={plannedFor}
                  onChange={(e) => setPlannedFor(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="plan-time-input">Time (optional)</Label>
                  {plannedTime ? (
                    <button
                      type="button"
                      onClick={() => setPlannedTime("")}
                      className="cursor-pointer text-xs font-medium text-accent hover:underline"
                    >
                      Clear time
                    </button>
                  ) : null}
                </div>
                <Input
                  id="plan-time-input"
                  type="time"
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-note-input">Reservation note (optional)</Label>
                <textarea
                  id="plan-note-input"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Table for 2, patio seating, ask about chef's special..."
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : isEditing ? "Save changes" : "Save reservation"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
