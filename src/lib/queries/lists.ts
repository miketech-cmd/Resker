"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { readApiResponse } from "@/lib/queries/restaurants";
import type {
  CreateListInput,
  ReorderListItemInput,
  UpdateListInput,
} from "@/lib/validation/lists";

export interface ListSummaryItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  itemCount: number;
  restaurantIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListRestaurantEntry {
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
  ratingHalf: number | null;
  notes: string | null;
  visitCount: number;
  lastVisitedOn: string | null;
  createdAt: string;
  updatedAt: string;
  position: string;
  addedAt: string;
}

export interface ListDetailResponse {
  list: ListSummaryItem;
  items: ListRestaurantEntry[];
}

export const listQueryKeys = {
  all: ["lists"] as const,
  detail: (id: string) => ["lists", "detail", id] as const,
};

export async function fetchUserLists(): Promise<ListSummaryItem[]> {
  const res = await fetch("/api/lists", { cache: "no-store" });
  const data = await readApiResponse<{ lists: ListSummaryItem[] }>(res);
  return data.lists;
}

export async function fetchListDetail(id: string): Promise<ListDetailResponse> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, { cache: "no-store" });
  return readApiResponse<ListDetailResponse>(res);
}

export function useListsQuery(initialData?: ListSummaryItem[], enabled = true) {
  return useQuery({
    queryKey: listQueryKeys.all,
    queryFn: fetchUserLists,
    initialData,
    enabled,
  });
}

export function useListDetailQuery(id: string, initialData?: ListDetailResponse) {
  return useQuery({
    queryKey: listQueryKeys.detail(id),
    queryFn: () => fetchListDetail(id),
    initialData,
  });
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateListInput) => {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await readApiResponse<{ list: ListSummaryItem }>(res);
      return payload.list;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<ListSummaryItem[]>(listQueryKeys.all, (prev) => {
        if (!prev) return [created];
        return [created, ...prev.filter((item) => item.id !== created.id)];
      });
    },
  });
}

export function useUpdateListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateListInput }) => {
      const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await readApiResponse<{ list: ListSummaryItem }>(res);
      return payload.list;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ListSummaryItem[]>(listQueryKeys.all, (prev) => {
        if (!prev) return prev;
        return prev.map((item) => (item.id === updated.id ? updated : item));
      });
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(updated.id), (prev) => {
        if (!prev) return prev;
        return { ...prev, list: updated };
      });
    },
  });
}

export function useDeleteListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return readApiResponse<{ deletedId: string }>(res);
    },
    onSuccess: ({ deletedId }) => {
      queryClient.setQueryData<ListSummaryItem[]>(listQueryKeys.all, (prev) => {
        if (!prev) return prev;
        return prev.filter((item) => item.id !== deletedId);
      });
      queryClient.removeQueries({ queryKey: listQueryKeys.detail(deletedId) });
    },
  });
}

export function useAddToListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      userRestaurantId,
    }: {
      listId: string;
      userRestaurantId: string;
    }) => {
      const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRestaurantId }),
      });
      return readApiResponse<{ added: boolean; position: string }>(res);
    },
    onSuccess: (_data, { listId, userRestaurantId }) => {
      queryClient.setQueryData<ListSummaryItem[]>(listQueryKeys.all, (prev) => {
        if (!prev) return prev;
        return prev.map((list) => {
          if (list.id !== listId) return list;
          if (list.restaurantIds.includes(userRestaurantId)) return list;
          const nextIds = [...list.restaurantIds, userRestaurantId];
          return { ...list, restaurantIds: nextIds, itemCount: nextIds.length };
        });
      });
      void queryClient.invalidateQueries({ queryKey: listQueryKeys.detail(listId) });
    },
  });
}

export function useRemoveFromListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      userRestaurantId,
    }: {
      listId: string;
      userRestaurantId: string;
    }) => {
      const res = await fetch(
        `/api/lists/${encodeURIComponent(listId)}/items?userRestaurantId=${encodeURIComponent(userRestaurantId)}`,
        { method: "DELETE" },
      );
      return readApiResponse<{ removed: boolean }>(res);
    },
    onSuccess: (_data, { listId, userRestaurantId }) => {
      queryClient.setQueryData<ListSummaryItem[]>(listQueryKeys.all, (prev) => {
        if (!prev) return prev;
        return prev.map((list) => {
          if (list.id !== listId) return list;
          const nextIds = list.restaurantIds.filter((id) => id !== userRestaurantId);
          return { ...list, restaurantIds: nextIds, itemCount: nextIds.length };
        });
      });
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.filter((item) => item.id !== userRestaurantId);
        return {
          list: {
            ...prev.list,
            restaurantIds: nextItems.map((i) => i.id),
            itemCount: nextItems.length,
          },
          items: nextItems,
        };
      });
    },
  });
}

export function useReorderListItemMutation(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payload,
    }: {
      payload: ReorderListItemInput;
      nextItems: ListRestaurantEntry[];
    }) => {
      const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/items/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readApiResponse<{ position: string }>(res);
    },
    onMutate: async ({ nextItems }) => {
      await queryClient.cancelQueries({ queryKey: listQueryKeys.detail(listId) });
      const previous = queryClient.getQueryData<ListDetailResponse>(listQueryKeys.detail(listId));
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        return {
          list: {
            ...prev.list,
            restaurantIds: nextItems.map((i) => i.id),
          },
          items: nextItems,
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKeys.detail(listId), context.previous);
      }
    },
    onSuccess: ({ position }, { payload }) => {
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === payload.userRestaurantId ? { ...item, position } : item,
          ),
        };
      });
    },
  });
}
