"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  readApiResponse,
  restaurantQueryKeys,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import {
  sortVisitsNewestFirst,
  syncRestaurantSummaryCache,
  visitQueryKeys,
  type VisitItem,
} from "@/lib/queries/visits";
import type {
  CompletePlanInput,
  CreatePlanInput,
  PlanStatus,
  UpdatePlanInput,
} from "@/lib/validation/plans";

export interface PlannedVisitRestaurantRef {
  id: string;
  placeId: string;
  googlePlaceId: string;
  googleMapsUri: string | null;
  lat: number | null;
  lng: number | null;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  cuisines: string[];
  priceLevel: number | null;
  status: "to_try" | "exploration" | "tried";
}

export interface PlannedVisitItem {
  id: string;
  userRestaurantId: string;
  plannedFor: string;
  plannedTime: string | null;
  note: string | null;
  status: PlanStatus;
  visitId: string | null;
  createdAt: string;
  restaurant: PlannedVisitRestaurantRef;
}

export interface CompletePlanResponse {
  alreadyCompleted: boolean;
  plan: PlannedVisitItem;
  visit: VisitItem | null;
  restaurant: UserRestaurantItem;
}

export const planQueryKeys = {
  all: ["plans"] as const,
};

function sortPlans(plans: PlannedVisitItem[]): PlannedVisitItem[] {
  return [...plans].sort((a, b) => {
    const aActive = a.status === "planned" ? 0 : 1;
    const bActive = b.status === "planned" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    const dateDiff = a.plannedFor.localeCompare(b.plannedFor);
    if (dateDiff !== 0) return dateDiff;

    const aTime = a.plannedTime ?? "99:99";
    const bTime = b.plannedTime ?? "99:99";
    const timeDiff = aTime.localeCompare(bTime);
    if (timeDiff !== 0) return timeDiff;

    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function fetchPlans(): Promise<PlannedVisitItem[]> {
  const res = await fetch("/api/plans", { cache: "no-store" });
  const data = await readApiResponse<{ plans: PlannedVisitItem[] }>(res);
  return data.plans;
}

export function usePlansQuery(initialData?: PlannedVisitItem[]) {
  return useQuery({
    queryKey: planQueryKeys.all,
    queryFn: fetchPlans,
    initialData,
  });
}

export function useCreatePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await readApiResponse<{ plan: PlannedVisitItem }>(res);
      return data.plan;
    },
    onSuccess: (plan) => {
      queryClient.setQueryData<PlannedVisitItem[]>(planQueryKeys.all, (prev) => {
        if (!prev) return [plan];
        return sortPlans([plan, ...prev.filter((item) => item.id !== plan.id)]);
      });
      void queryClient.invalidateQueries({ queryKey: planQueryKeys.all });
    },
  });
}

export function useUpdatePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePlanInput }) => {
      const res = await fetch(`/api/plans/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await readApiResponse<{ plan: PlannedVisitItem }>(res);
      return data.plan;
    },
    onSuccess: (plan) => {
      queryClient.setQueryData<PlannedVisitItem[]>(planQueryKeys.all, (prev) => {
        if (!prev) return [plan];
        return sortPlans(prev.map((item) => (item.id === plan.id ? plan : item)));
      });
      void queryClient.invalidateQueries({ queryKey: planQueryKeys.all });
    },
  });
}

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/plans/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return readApiResponse<{ deletedId: string }>(res);
    },
    onSuccess: ({ deletedId }) => {
      queryClient.setQueryData<PlannedVisitItem[]>(planQueryKeys.all, (prev) => {
        if (!prev) return prev;
        return prev.filter((item) => item.id !== deletedId);
      });
      void queryClient.invalidateQueries({ queryKey: planQueryKeys.all });
    },
  });
}

export function useCompletePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: Partial<CompletePlanInput> }) => {
      const res = await fetch(`/api/plans/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      return readApiResponse<CompletePlanResponse>(res);
    },
    onSuccess: ({ plan, visit, restaurant }) => {
      queryClient.setQueryData<PlannedVisitItem[]>(planQueryKeys.all, (prev) => {
        if (!prev) return [plan];
        return sortPlans(prev.map((item) => (item.id === plan.id ? plan : item)));
      });

      if (visit) {
        queryClient.setQueryData<VisitItem[]>(
          visitQueryKeys.byRestaurant(restaurant.id),
          (prev) => {
            if (!prev) return [visit];
            return sortVisitsNewestFirst([visit, ...prev.filter((v) => v.id !== visit.id)]);
          },
        );
      }

      syncRestaurantSummaryCache(queryClient, restaurant);
      void queryClient.invalidateQueries({ queryKey: planQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.detail(restaurant.id) });
      void queryClient.invalidateQueries({ queryKey: visitQueryKeys.byRestaurant(restaurant.id) });
    },
  });
}
