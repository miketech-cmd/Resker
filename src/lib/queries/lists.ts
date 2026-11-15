"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  readApiResponse,
  restaurantQueryKeys,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";
import type {
  ClonePublicListInput,
  CreateListInput,
  InviteListMemberInput,
  ListMemberRole,
  ReorderListItemInput,
  UpdateListInput,
} from "@/lib/validation/lists";

export type ListAccessRole = "owner" | "editor" | "viewer";

export interface ListMemberItem {
  userId: string;
  username: string | null;
  name: string;
  avatarUrl?: string | null;
  role: ListMemberRole;
  createdAt: string;
}

export interface ListSummaryItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  publicSlug?: string | null;
  isPublic?: boolean;
  isFeatured?: boolean;
  city?: string | null;
  copyCount?: number;
  sourceListId?: string | null;
  itemCount: number;
  restaurantIds: string[];
  placeIds?: string[];
  viewerRole?: ListAccessRole;
  ownerName?: string | null;
  ownerUsername?: string | null;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicListSummaryItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  publicSlug: string;
  isFeatured: boolean;
  city: string | null;
  copyCount: number;
  itemCount: number;
  curatorName: string;
  curatorUsername: string | null;
  cuisines: string[];
  savedCopyListId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicListRestaurantEntry {
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
  curatorNote: string | null;
  position: string;
  addedAt: string;
  savedByViewer: boolean;
  viewerRestaurantId: string | null;
}

export interface PublicListDetailResponse {
  list: PublicListSummaryItem;
  items: PublicListRestaurantEntry[];
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
  isOwnedByViewer?: boolean;
  viewerRestaurantId?: string | null;
}

export interface ListDetailResponse {
  list: ListSummaryItem;
  items: ListRestaurantEntry[];
  members?: ListMemberItem[];
}

export const listQueryKeys = {
  all: ["lists"] as const,
  detail: (id: string) => ["lists", "detail", id] as const,
  publicAll: (q = "", city = "") => ["lists", "public", q, city] as const,
  publicDetail: (slug: string) => ["lists", "public", "detail", slug] as const,
};

export async function fetchPublicLists(filters?: {
  q?: string;
  city?: string;
}): Promise<PublicListSummaryItem[]> {
  const params = new URLSearchParams();
  if (filters?.q?.trim()) params.set("q", filters.q.trim());
  if (filters?.city?.trim()) params.set("city", filters.city.trim());
  const qs = params.toString();
  const res = await fetch(qs ? `/api/lists/public?${qs}` : "/api/lists/public", {
    cache: "no-store",
  });
  const data = await readApiResponse<{ lists: PublicListSummaryItem[] }>(res);
  return data.lists;
}

export async function fetchPublicListDetail(slug: string): Promise<PublicListDetailResponse> {
  const res = await fetch(`/api/lists/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
  return readApiResponse<PublicListDetailResponse>(res);
}

export function usePublicListsQuery(
  filters?: { q?: string; city?: string },
  initialData?: PublicListSummaryItem[],
  enabled = true,
) {
  const q = filters?.q?.trim() ?? "";
  const city = filters?.city?.trim() ?? "";
  return useQuery({
    queryKey: listQueryKeys.publicAll(q, city),
    queryFn: () => fetchPublicLists({ q, city }),
    initialData: !q && !city ? initialData : undefined,
    enabled,
  });
}

export function usePublicListDetailQuery(slug: string, initialData?: PublicListDetailResponse) {
  return useQuery({
    queryKey: listQueryKeys.publicDetail(slug),
    queryFn: () => fetchPublicListDetail(slug),
    initialData,
  });
}

export function useSavePublicSpotMutation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceRestaurantId: string) => {
      const res = await fetch(`/api/lists/public/${encodeURIComponent(slug)}/save-place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRestaurantId }),
      });
      return readApiResponse<{ created: boolean; restaurant: UserRestaurantItem }>(res);
    },
    onSuccess: ({ restaurant }, sourceRestaurantId) => {
      queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) => {
        if (!prev) return [restaurant];
        if (prev.some((item) => item.id === restaurant.id)) return prev;
        return [restaurant, ...prev];
      });
      queryClient.setQueryData<PublicListDetailResponse>(
        listQueryKeys.publicDetail(slug),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === sourceRestaurantId || item.placeId === restaurant.placeId
                ? { ...item, savedByViewer: true, viewerRestaurantId: restaurant.id }
                : item,
            ),
          };
        },
      );
    },
  });
}

export function useClonePublicListMutation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: ClonePublicListInput) => {
      const res = await fetch(`/api/lists/public/${encodeURIComponent(slug)}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      return readApiResponse<{
        list: ListSummaryItem;
        addedRestaurantsCount: number;
        totalItemsCount: number;
      }>(res);
    },
    onSuccess: ({ list }) => {
      queryClient.setQueryData<ListSummaryItem[]>(listQueryKeys.all, (prev) => {
        if (!prev) return [list];
        return [list, ...prev.filter((item) => item.id !== list.id)];
      });
      queryClient.setQueryData<PublicListDetailResponse>(
        listQueryKeys.publicDetail(slug),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            list: {
              ...prev.list,
              copyCount: prev.list.copyCount + 1,
              savedCopyListId: list.id,
            },
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: listQueryKeys.publicDetail(slug) });
      void queryClient.invalidateQueries({ queryKey: ["lists", "public"] });
    },
  });
}

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
      void queryClient.invalidateQueries({
        queryKey: listQueryKeys.all,
        exact: true,
        refetchType: "none",
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
          ...prev,
          list: {
            ...prev.list,
            restaurantIds: nextItems.map((i) => i.id),
            placeIds: nextItems.map((i) => i.placeId),
            itemCount: nextItems.length,
          },
          items: nextItems,
        };
      });
      void queryClient.invalidateQueries({
        queryKey: listQueryKeys.all,
        exact: true,
        refetchType: "none",
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
          ...prev,
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

export function useInviteListMemberMutation(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteListMemberInput) => {
      const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await readApiResponse<{ member: ListMemberItem }>(res);
      return payload.member;
    },
    onSuccess: (member) => {
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        const current = prev.members ?? [];
        const exists = current.some((m) => m.userId === member.userId);
        const nextMembers = exists
          ? current.map((m) => (m.userId === member.userId ? member : m))
          : [...current, member];
        return {
          ...prev,
          list: {
            ...prev.list,
            memberCount: nextMembers.length,
          },
          members: nextMembers,
        };
      });
      void queryClient.invalidateQueries({
        queryKey: listQueryKeys.all,
        exact: true,
        refetchType: "none",
      });
    },
  });
}

export function useUpdateListMemberRoleMutation(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ListMemberRole }) => {
      const res = await fetch(
        `/api/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      return readApiResponse<{ role: ListMemberRole }>(res);
    },
    onSuccess: ({ role }, { userId }) => {
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: (prev.members ?? []).map((m) => (m.userId === userId ? { ...m, role } : m)),
        };
      });
    },
  });
}

export function useRemoveListMemberMutation(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(
        `/api/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      return readApiResponse<{ removed: boolean; userId: string }>(res);
    },
    onSuccess: ({ userId }) => {
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        const nextMembers = (prev.members ?? []).filter((m) => m.userId !== userId);
        return {
          ...prev,
          list: {
            ...prev.list,
            memberCount: nextMembers.length,
          },
          members: nextMembers,
        };
      });
      void queryClient.invalidateQueries({
        queryKey: listQueryKeys.all,
        exact: true,
        refetchType: "none",
      });
    },
  });
}

export function useSaveSharedSpotMutation(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceRestaurantId: string) => {
      const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/save-place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRestaurantId }),
      });
      return readApiResponse<{ created: boolean; restaurant: UserRestaurantItem }>(res);
    },
    onSuccess: ({ restaurant }, sourceRestaurantId) => {
      queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) => {
        if (!prev) return [restaurant];
        if (prev.some((item) => item.id === restaurant.id)) return prev;
        return [restaurant, ...prev];
      });
      queryClient.setQueryData<ListDetailResponse>(listQueryKeys.detail(listId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === sourceRestaurantId || item.placeId === restaurant.placeId
              ? { ...item, viewerRestaurantId: restaurant.id }
              : item,
          ),
        };
      });
    },
  });
}
