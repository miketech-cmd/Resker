"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FoodIconKey } from "@/components/icons/food-icons";
import type {
  CreateRestaurantInput,
  RestaurantStatus,
  UpdateRestaurantInput,
} from "@/lib/validation/places";

export interface UserRestaurantItem {
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
  status: RestaurantStatus;
  ratingHalf: number | null;
  notes: string | null;
  visitCount: number;
  lastVisitedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacePrefillData {
  googlePlaceId: string;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  cuisines: string[];
  priceLevel: number | null;
  googleMapsUri: string | null;
  suggestedFoodIcon: FoodIconKey;
}

export type ResolvePlaceResponse =
  | {
      alreadySaved: true;
      googlePlaceId: string;
      existingRestaurant: UserRestaurantItem;
      prefill: null;
    }
  | {
      alreadySaved: false;
      googlePlaceId: string;
      existingRestaurant: null;
      prefill: PlacePrefillData;
    };

export interface AutocompleteSuggestionItem {
  googlePlaceId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  cuisines: string[];
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    (T & { error?: { code?: string; message?: string } }) | null;

  if (!response.ok) {
    const code = payload?.error?.code ?? "REQUEST_FAILED";
    const message = payload?.error?.message ?? "Something went wrong. Please try again.";
    throw new ApiRequestError(response.status, code, message);
  }

  if (!payload) {
    throw new ApiRequestError(response.status, "EMPTY_RESPONSE", "Empty server response.");
  }

  return payload;
}

export const restaurantQueryKeys = {
  all: ["restaurants"] as const,
  detail: (id: string) => ["restaurants", "detail", id] as const,
};

export async function fetchUserRestaurants(): Promise<UserRestaurantItem[]> {
  const res = await fetch("/api/restaurants", { cache: "no-store" });
  const data = await readApiResponse<{ restaurants: UserRestaurantItem[] }>(res);
  return data.restaurants;
}

export async function fetchUserRestaurantDetail(id: string): Promise<UserRestaurantItem> {
  const res = await fetch(`/api/restaurants/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = await readApiResponse<{ restaurant: UserRestaurantItem }>(res);
  return data.restaurant;
}

export function useRestaurantsQuery(initialData?: UserRestaurantItem[]) {
  return useQuery({
    queryKey: restaurantQueryKeys.all,
    queryFn: fetchUserRestaurants,
    initialData,
  });
}

export function useRestaurantDetailQuery(id: string, initialData?: UserRestaurantItem) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: restaurantQueryKeys.detail(id),
    queryFn: () => fetchUserRestaurantDetail(id),
    initialData: () => {
      if (initialData) return initialData;
      return queryClient
        .getQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all)
        ?.find((item) => item.id === id);
    },
  });
}

export function useSaveRestaurantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRestaurantInput) => {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return readApiResponse<{ created: boolean; restaurant: UserRestaurantItem }>(res);
    },
    onSuccess: ({ restaurant }) => {
      queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) => {
        if (!prev) return [restaurant];
        const without = prev.filter((item) => item.id !== restaurant.id);
        return [restaurant, ...without];
      });
      queryClient.setQueryData(restaurantQueryKeys.detail(restaurant.id), restaurant);
      void queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.all });
    },
  });
}

export function useUpdateRestaurantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRestaurantInput }) => {
      const res = await fetch(`/api/restaurants/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await readApiResponse<{ restaurant: UserRestaurantItem }>(res);
      return payload.restaurant;
    },
    onMutate: async ({ id, data }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: restaurantQueryKeys.all }),
        queryClient.cancelQueries({ queryKey: restaurantQueryKeys.detail(id) }),
      ]);

      const previousList = queryClient.getQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all);
      const previousDetail = queryClient.getQueryData<UserRestaurantItem>(
        restaurantQueryKeys.detail(id),
      );

      const applyPatch = (item: UserRestaurantItem): UserRestaurantItem => ({
        ...item,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.address !== undefined ? { address: data.address ?? null } : {}),
        ...(data.city !== undefined ? { city: data.city ?? null } : {}),
        ...(data.countryCode !== undefined
          ? { countryCode: data.countryCode ? data.countryCode.toUpperCase() : null }
          : {}),
        ...(data.cuisines !== undefined ? { cuisines: data.cuisines } : {}),
        ...(data.priceLevel !== undefined ? { priceLevel: data.priceLevel ?? null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ratingHalf !== undefined ? { ratingHalf: data.ratingHalf ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
        updatedAt: new Date().toISOString(),
      });

      queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) =>
        prev?.map((item) => (item.id === id ? applyPatch(item) : item)),
      );
      queryClient.setQueryData<UserRestaurantItem>(restaurantQueryKeys.detail(id), (prev) =>
        prev ? applyPatch(prev) : prev,
      );

      return { previousList, previousDetail };
    },
    onError: (_error, variables, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(restaurantQueryKeys.all, context.previousList);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(restaurantQueryKeys.detail(variables.id), context.previousDetail);
      }
    },
    onSuccess: (restaurant) => {
      queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) =>
        prev ? prev.map((item) => (item.id === restaurant.id ? restaurant : item)) : [restaurant],
      );
      queryClient.setQueryData(restaurantQueryKeys.detail(restaurant.id), restaurant);
    },
  });
}

export function useDeleteRestaurantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/restaurants/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return readApiResponse<{ deletedId: string }>(res);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: restaurantQueryKeys.all });
      const previousList = queryClient.getQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all);
      queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) =>
        prev?.filter((item) => item.id !== id),
      );
      return { previousList };
    },
    onError: (_error, _id, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(restaurantQueryKeys.all, context.previousList);
      }
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: restaurantQueryKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.all });
    },
  });
}
