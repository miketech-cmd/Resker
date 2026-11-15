"use client";

import {
  Calendar,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarRating, formatStars } from "@/components/ui/star-rating";
import { toast } from "@/components/ui/toast";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { useDeleteVisitMutation, type VisitItem } from "@/lib/queries/visits";
import { cn } from "@/lib/utils";
import { formatVisitDate } from "@/lib/validation/visits";

export function VisitTimeline({
  restaurant,
  visits,
  onOpenLogNew,
  onOpenEdit,
}: {
  restaurant: UserRestaurantItem;
  visits: VisitItem[];
  onOpenLogNew: () => void;
  onOpenEdit: (visit: VisitItem) => void;
}) {
  const deleteVisitMutation = useDeleteVisitMutation(restaurant.id);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const latestRatedVisit = visits.find((v) => v.ratingHalf !== null);

  async function handleConfirmDelete(visitId: string) {
    try {
      await deleteVisitMutation.mutateAsync(visitId);
      setConfirmDeleteId(null);
      toast("Visit removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove visit.");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
            <Calendar className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-medium text-ink">Visits</h2>
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
                {visits.length}
              </span>
            </div>
            <p className="text-xs text-muted">
              {restaurant.lastVisitedOn
                ? `Last visited ${formatVisitDate(restaurant.lastVisitedOn)}`
                : "Record what you ordered and how it went"}
            </p>
          </div>
        </div>

        <Button type="button" size="sm" onClick={onOpenLogNew} className="min-h-11 gap-1.5 px-4">
          <Plus className="size-4" aria-hidden="true" />
          Log visit
        </Button>
      </div>

      {latestRatedVisit && restaurant.ratingHalf !== null ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-surface-elevated/45 px-3 py-2 text-xs text-muted dark:bg-[#191512]">
          <span>
            Overall: <strong className="text-ink">{formatStars(restaurant.ratingHalf)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Latest visit:{" "}
            <strong className="text-ink">{formatStars(latestRatedVisit.ratingHalf)}</strong>
          </span>
        </div>
      ) : null}

      {visits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-elevated/30 px-4 py-6 text-center dark:bg-[#191512]/70">
          <UtensilsCrossed className="mx-auto size-5 text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-ink">No visits logged yet</p>
          <p className="mt-1 text-xs text-muted">
            Log dishes in under 20 seconds so you remember what to order next time.
          </p>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Visit history">
          {visits.map((visit) => {
            const confirming = confirmDeleteId === visit.id;
            return (
              <li
                key={visit.id}
                className="space-y-3 rounded-xl border border-border/90 bg-surface-elevated/45 p-3.5 dark:border-[#3d342d] dark:bg-[#191512]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {formatVisitDate(visit.visitedOn)}
                    </p>
                    {visit.ratingHalf ? (
                      <StarRating
                        value={visit.ratingHalf}
                        readOnly
                        size="sm"
                        label={`Visit on ${visit.visitedOn}`}
                      />
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenEdit(visit)}
                      aria-label={`Edit visit on ${visit.visitedOn}`}
                      className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(confirming ? null : visit.id)}
                      aria-label={`Delete visit on ${visit.visitedOn}`}
                      className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {visit.notes ? (
                  <p className="text-sm whitespace-pre-line text-muted">{visit.notes}</p>
                ) : null}

                {visit.dishes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {visit.dishes.map((dish) => (
                      <div
                        key={dish.id}
                        className={cn(
                          "inline-flex max-w-full flex-col rounded-xl border px-2.5 py-1.5 text-xs",
                          dish.wouldOrderAgain === true
                            ? "border-tried/40 bg-tried-bg/75 text-tried-ink"
                            : dish.wouldOrderAgain === false
                              ? "border-border bg-surface text-muted line-through decoration-muted/60"
                              : "border-border bg-surface text-ink",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {dish.wouldOrderAgain === true ? (
                            <ThumbsUp className="size-3 shrink-0" aria-label="Would order again" />
                          ) : dish.wouldOrderAgain === false ? (
                            <ThumbsDown className="size-3 shrink-0" aria-label="Skip next time" />
                          ) : null}
                          <span className="truncate">{dish.name}</span>
                        </span>
                        {dish.note ? (
                          <span className="mt-0.5 text-[11px] opacity-85 not-italic no-underline">
                            {dish.note}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {confirming ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs">
                    <span className="font-medium text-ink">Delete this visit?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleteVisitMutation.isPending}
                        className="min-h-8 cursor-pointer rounded-full px-3 font-medium text-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConfirmDelete(visit.id)}
                        disabled={deleteVisitMutation.isPending}
                        className="min-h-8 cursor-pointer rounded-full bg-danger px-3 font-medium text-white"
                      >
                        {deleteVisitMutation.isPending ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
