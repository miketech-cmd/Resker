"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FoodIconKey } from "@/components/icons/food-icons";
import type { CreateRestaurantInput, RestaurantStatus } from "@/lib/validation/places";

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
};

export async function fetchUserRestaurants(): Promise<UserRestaurantItem[]> {
  const res = await fetch("/api/restaurants", { cache: "no-store" });
  const data = await readApiResponse<{ restaurants: UserRestaurantItem[] }>(res);
  return data.restaurants;
}

export function useRestaurantsQuery(initialData?: UserRestaurantItem[]) {
  return useQuery({
    queryKey: restaurantQueryKeys.all,
    queryFn: fetchUserRestaurants,
    initialData,
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
      void queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.all });
    },
  });
}
