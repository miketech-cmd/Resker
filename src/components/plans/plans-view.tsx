"use client";

import {
  CalendarCheck2,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Navigation,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import { downloadPlanIcs } from "@/lib/places/ics";
import { buildMapsDirectionsUrl, buildMapsPlaceUrl } from "@/lib/places/maps-links";
import {
  useCompletePlanMutation,
  useDeletePlanMutation,
  usePlansQuery,
  useUpdatePlanMutation,
  type PlannedVisitItem,
} from "@/lib/queries/plans";
import { useRestaurantsQuery, type UserRestaurantItem } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { formatPlanDateLabel, formatPlanTime } from "@/lib/validation/plans";

const DynamicPlanVisitSheet = dynamic(
  () => import("@/components/places/plan-visit-sheet").then((mod) => mod.PlanVisitSheet),
  { ssr: false },
);

export function PlansView({
  initialPlans,
  initialRestaurants,
}: {
  initialPlans: PlannedVisitItem[];
  initialRestaurants: UserRestaurantItem[];
}) {
  const { data: plans = initialPlans } = usePlansQuery(initialPlans);
  const { data: restaurants = initialRestaurants } = useRestaurantsQuery(initialRestaurants);

  const completeMutation = useCompletePlanMutation();
  const updateMutation = useUpdatePlanMutation();
  const deleteMutation = useDeletePlanMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlannedVisitItem | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const { upcomingPlans, pastPlans } = useMemo(() => {
    const upcoming: PlannedVisitItem[] = [];
    const past: PlannedVisitItem[] = [];
    for (const plan of plans) {
      if (plan.status === "planned") {
        upcoming.push(plan);
      } else {
        past.push(plan);
      }
    }
    return { upcomingPlans: upcoming, pastPlans: past };
  }, [plans]);

  async function handleLogIt(plan: PlannedVisitItem) {
    setCompletingId(plan.id);
    try {
      const wasPromotedFromUntried = plan.restaurant.status !== "tried";
      const result = await completeMutation.mutateAsync({ id: plan.id });
      if (result.alreadyCompleted) {
        toast("Already logged to visits");
      } else if (wasPromotedFromUntried && result.restaurant.status === "tried") {
        toast("Visit logged · Moved to Tried");
      } else {
        toast("Visit logged");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log planned visit.");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleCancelPlan(plan: PlannedVisitItem) {
    try {
      await updateMutation.mutateAsync({
        id: plan.id,
        input: { status: "cancelled" },
      });
      toast("Reservation cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel reservation.");
    }
  }

  async function handleDeletePlan(plan: PlannedVisitItem) {
    try {
      await deleteMutation.mutateAsync(plan.id);
      toast("Removed planned visit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove planned visit.");
    }
  }

  function handleDownloadIcs(plan: PlannedVisitItem) {
    downloadPlanIcs(plan);
    toast("Calendar event (.ics) downloaded");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Plans</h1>
          <p className="mt-1 text-sm text-muted">
            Upcoming tables, dinner reminders, and one-tap visit logging.
          </p>
        </div>

        <Button type="button" size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <CalendarPlus className="size-4" aria-hidden="true" />
          Plan visit
        </Button>
      </header>

      {upcomingPlans.length === 0 ? (
        <EmptyState
          title="No upcoming plans"
          description="Schedule a reservation from any saved spot or start a plan here."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)} className="gap-2">
              <CalendarPlus className="size-4" aria-hidden="true" />
              Plan a visit
            </Button>
          }
        />
      ) : (
        <section aria-label="Upcoming plans" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium text-ink">
              Upcoming ({upcomingPlans.length})
            </h2>
          </div>

          <ul className="space-y-3">
            {upcomingPlans.map((plan) => {
              const iconKey = mapCuisinesToFoodIcon(plan.restaurant.cuisines);
              const dateLabel = formatPlanDateLabel(plan.plannedFor);
              const timeLabel = formatPlanTime(plan.plannedTime);
              const priceLabel = formatPriceLevel(plan.restaurant.priceLevel);
              const isCompleting = completingId === plan.id && completeMutation.isPending;

              return (
                <li key={plan.id}>
                  <Card className="space-y-3.5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-accent">
                          <FoodIcon name={iconKey} className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/places/${plan.restaurant.id}`}
                            className="block truncate font-serif text-lg font-medium text-ink hover:text-accent hover:underline"
                          >
                            {plan.restaurant.name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                            {plan.restaurant.city ? <span>{plan.restaurant.city}</span> : null}
                            {priceLabel ? <span>{priceLabel}</span> : null}
                            {plan.restaurant.cuisines.slice(0, 2).map((cuisine) => (
                              <span
                                key={cuisine}
                                className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px]"
                              >
                                {cuisine}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                        <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent tabular-nums">
                          {dateLabel}
                        </span>
                        {timeLabel ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted tabular-nums">
                            <Clock className="size-3" aria-hidden="true" />
                            {timeLabel}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">{plan.plannedFor}</span>
                        )}
                      </div>
                    </div>

                    {plan.note ? (
                      <p className="rounded-xl border border-border bg-surface-elevated/70 px-3 py-2 text-sm text-ink">
                        {plan.note}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleLogIt(plan)}
                        disabled={isCompleting}
                        className="gap-1.5"
                      >
                        <Check className="size-4" aria-hidden="true" />
                        {isCompleting ? "Logging..." : "Log it"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadIcs(plan)}
                        className="gap-1.5"
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                        Calendar (.ics)
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPlan(plan)}
                        className="gap-1.5"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </Button>

                      <a
                        href={buildMapsDirectionsUrl(plan.restaurant)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "gap-1.5 text-muted hover:text-ink",
                        )}
                      >
                        <Navigation className="size-3.5" aria-hidden="true" />
                        Directions
                      </a>

                      <a
                        href={buildMapsPlaceUrl(plan.restaurant)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "gap-1.5 text-muted hover:text-ink",
                        )}
                      >
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        Maps
                      </a>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelPlan(plan)}
                        disabled={updateMutation.isPending}
                        className="ml-auto gap-1 text-muted hover:text-danger"
                      >
                        <XCircle className="size-3.5" aria-hidden="true" />
                        Cancel
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pastPlans.length > 0 ? (
        <section aria-label="Completed and past plans" className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setShowPast((prev) => !prev)}
            aria-expanded={showPast}
            className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-surface px-4 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-elevated"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarCheck2 className="size-4 text-muted" aria-hidden="true" />
              Completed &amp; Past ({pastPlans.length})
            </span>
            {showPast ? (
              <ChevronUp className="size-4 text-muted" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 text-muted" aria-hidden="true" />
            )}
          </button>

          {showPast ? (
            <ul className="space-y-2.5">
              {pastPlans.map((plan) => {
                const timeLabel = formatPlanTime(plan.plannedTime);
                return (
                  <li key={plan.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/places/${plan.restaurant.id}`}
                            className="truncate font-serif text-base font-medium text-ink hover:text-accent hover:underline"
                          >
                            {plan.restaurant.name}
                          </Link>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              plan.status === "done"
                                ? "bg-tried-bg text-tried-ink"
                                : "bg-surface-elevated text-muted",
                            )}
                          >
                            {plan.status === "done" ? "Logged" : "Cancelled"}
                          </span>
                        </div>
                        <p className="text-xs text-muted tabular-nums">
                          {plan.plannedFor}
                          {timeLabel ? ` · ${timeLabel}` : ""}
                          {plan.note ? ` · ${plan.note}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {plan.status === "cancelled" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPlan(plan)}
                          >
                            Reschedule
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePlan(plan)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Remove plan for ${plan.restaurant.name}`}
                          className="text-muted hover:text-danger"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {createOpen ? (
        <DynamicPlanVisitSheet
          restaurants={restaurants}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      ) : null}

      {editingPlan ? (
        <DynamicPlanVisitSheet
          key={editingPlan.id}
          plan={editingPlan}
          open={Boolean(editingPlan)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingPlan(null);
          }}
        />
      ) : null}
    </div>
  );
}
