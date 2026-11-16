"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  readApiResponse,
  restaurantQueryKeys,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import type { CreateVisitInput, UpdateVisitInput } from "@/lib/validation/visits";

export interface VisitDishItem {
  id: string;
  visitId: string;
  name: string;
  note: string | null;
  wouldOrderAgain: boolean | null;
  position: number;
}

export interface VisitItem {
  id: string;
  userRestaurantId: string;
  visitedOn: string;
  ratingHalf: number | null;
  notes: string | null;
  dishes: VisitDishItem[];
  createdAt: string;
  updatedAt: string;
}

export interface VisitWriteResponse {
  visit: VisitItem;
  restaurant: UserRestaurantItem;
}

export interface VisitDeleteResponse {
  deletedId: string;
  restaurantId: string;
  restaurant: UserRestaurantItem;
}

export const visitQueryKeys = {
  byRestaurant: (restaurantId: string) =>
    ["restaurants", "detail", restaurantId, "visits"] as const,
};

export function sortVisitsNewestFirst(list: VisitItem[]): VisitItem[] {
  return [...list].sort((a, b) => {
    const dateDiff = b.visitedOn.localeCompare(a.visitedOn);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function syncRestaurantSummaryCache(
  queryClient: QueryClient,
  restaurant: UserRestaurantItem,
) {
  queryClient.setQueryData<UserRestaurantItem>(
    restaurantQueryKeys.detail(restaurant.id),
    restaurant,
  );
  queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) => {
    if (!prev) return prev;
    return prev.map((item) => (item.id === restaurant.id ? restaurant : item));
  });
}

export async function fetchRestaurantVisits(restaurantId: string): Promise<VisitItem[]> {
  const res = await fetch(`/api/restaurants/${encodeURIComponent(restaurantId)}/visits`, {
    cache: "no-store",
  });
  const data = await readApiResponse<{ visits: VisitItem[] }>(res);
  return data.visits;
}

export function useRestaurantVisitsQuery(restaurantId: string, initialData?: VisitItem[]) {
  return useQuery({
    queryKey: visitQueryKeys.byRestaurant(restaurantId),
    queryFn: () => fetchRestaurantVisits(restaurantId),
    initialData,
  });
}

export function useCreateVisitMutation(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      const res = await fetch(`/api/restaurants/${encodeURIComponent(restaurantId)}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return readApiResponse<VisitWriteResponse>(res);
    },
    onSuccess: ({ visit, restaurant }) => {
      queryClient.setQueryData<VisitItem[]>(visitQueryKeys.byRestaurant(restaurantId), (prev) => {
        if (!prev) return [visit];
        return sortVisitsNewestFirst([visit, ...prev.filter((v) => v.id !== visit.id)]);
      });
      syncRestaurantSummaryCache(queryClient, restaurant);
    },
  });
}

export function useUpdateVisitMutation(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, data }: { visitId: string; data: UpdateVisitInput }) => {
      const res = await fetch(`/api/visits/${encodeURIComponent(visitId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return readApiResponse<VisitWriteResponse>(res);
    },
    onSuccess: ({ visit, restaurant }) => {
      queryClient.setQueryData<VisitItem[]>(visitQueryKeys.byRestaurant(restaurantId), (prev) => {
        if (!prev) return [visit];
        return sortVisitsNewestFirst(prev.map((v) => (v.id === visit.id ? visit : v)));
      });
      syncRestaurantSummaryCache(queryClient, restaurant);
    },
  });
}

export function useDeleteVisitMutation(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (visitId: string) => {
      const res = await fetch(`/api/visits/${encodeURIComponent(visitId)}`, {
        method: "DELETE",
      });
      return readApiResponse<VisitDeleteResponse>(res);
    },
    onSuccess: ({ deletedId, restaurant }) => {
      queryClient.setQueryData<VisitItem[]>(visitQueryKeys.byRestaurant(restaurantId), (prev) => {
        if (!prev) return prev;
        return prev.filter((v) => v.id !== deletedId);
      });
      syncRestaurantSummaryCache(queryClient, restaurant);
    },
  });
}
