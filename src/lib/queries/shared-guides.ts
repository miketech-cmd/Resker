"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  readApiResponse,
  restaurantQueryKeys,
  type UserRestaurantItem,
} from "@/lib/queries/restaurants";

export interface LibraryViewerSummaryItem {
  userId: string;
  name: string;
  username: string | null;
  createdAt: string;
}

export interface SharedLibraryGuideSummaryItem {
  ownerId: string;
  ownerName: string;
  ownerUsername: string | null;
  itemCount: number;
  citiesCount: number;
  cuisines: string[];
  sharedAt: string;
}

export interface SharedGuidesOverviewResponse {
  sharedWithMe: SharedLibraryGuideSummaryItem[];
  sharingWith: LibraryViewerSummaryItem[];
  inviteToken: string | null;
  myLibraryCount: number;
}

export interface SharedLibraryRestaurantItem {
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

export interface SharedLibraryGuideDetailResponse {
  guide: SharedLibraryGuideSummaryItem;
  items: SharedLibraryRestaurantItem[];
  isOwnPreview: boolean;
}

export const sharedGuideQueryKeys = {
  overview: ["shared-guides", "overview"] as const,
  detail: (ownerId: string) => ["shared-guides", "detail", ownerId] as const,
};

export async function fetchSharedGuidesOverview(): Promise<SharedGuidesOverviewResponse> {
  const res = await fetch("/api/shared-guides", { cache: "no-store" });
  return readApiResponse<SharedGuidesOverviewResponse>(res);
}

export async function fetchSharedGuideDetail(
  ownerId: string,
): Promise<SharedLibraryGuideDetailResponse> {
  const res = await fetch(`/api/shared-guides/${encodeURIComponent(ownerId)}`, {
    cache: "no-store",
  });
  return readApiResponse<SharedLibraryGuideDetailResponse>(res);
}

export function useSharedGuidesOverviewQuery(
  initialData?: SharedGuidesOverviewResponse,
  enabled = true,
) {
  return useQuery({
    queryKey: sharedGuideQueryKeys.overview,
    queryFn: fetchSharedGuidesOverview,
    initialData,
    enabled,
  });
}

export function useSharedGuideDetailQuery(
  ownerId: string,
  initialData?: SharedLibraryGuideDetailResponse,
) {
  return useQuery({
    queryKey: sharedGuideQueryKeys.detail(ownerId),
    queryFn: () => fetchSharedGuideDetail(ownerId),
    initialData,
  });
}

export function useInviteLibraryViewerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch("/api/shared-guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await readApiResponse<{ viewer: LibraryViewerSummaryItem }>(res);
      return data.viewer;
    },
    onSuccess: (viewer) => {
      queryClient.setQueryData<SharedGuidesOverviewResponse>(
        sharedGuideQueryKeys.overview,
        (prev) => {
          if (!prev) return prev;
          const without = prev.sharingWith.filter((item) => item.userId !== viewer.userId);
          return {
            ...prev,
            sharingWith: [viewer, ...without],
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: sharedGuideQueryKeys.overview });
    },
  });
}

export function useRemoveLibraryViewerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/shared-guides/viewers/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      return readApiResponse<{ removedUserId: string }>(res);
    },
    onSuccess: ({ removedUserId }) => {
      queryClient.setQueryData<SharedGuidesOverviewResponse>(
        sharedGuideQueryKeys.overview,
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sharingWith: prev.sharingWith.filter((item) => item.userId !== removedUserId),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: sharedGuideQueryKeys.overview });
    },
  });
}

export function useRotateLibraryInviteTokenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shared-guides/invite-link", { method: "POST" });
      const data = await readApiResponse<{ inviteToken: string }>(res);
      return data.inviteToken;
    },
    onSuccess: (inviteToken) => {
      queryClient.setQueryData<SharedGuidesOverviewResponse>(
        sharedGuideQueryKeys.overview,
        (prev) => (prev ? { ...prev, inviteToken } : prev),
      );
      void queryClient.invalidateQueries({ queryKey: sharedGuideQueryKeys.overview });
    },
  });
}

export function useRevokeLibraryInviteTokenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shared-guides/invite-link", { method: "DELETE" });
      return readApiResponse<{ inviteToken: null }>(res);
    },
    onSuccess: () => {
      queryClient.setQueryData<SharedGuidesOverviewResponse>(
        sharedGuideQueryKeys.overview,
        (prev) => (prev ? { ...prev, inviteToken: null } : prev),
      );
      void queryClient.invalidateQueries({ queryKey: sharedGuideQueryKeys.overview });
    },
  });
}

export function useAcceptLibraryInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch(`/api/shared-guides/invite/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      return readApiResponse<{
        ownerId: string;
        ownerName: string;
        ownerUsername: string | null;
      }>(res);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sharedGuideQueryKeys.overview });
    },
  });
}

export function useLeaveSharedGuideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ownerId: string) => {
      const res = await fetch(`/api/shared-guides/${encodeURIComponent(ownerId)}`, {
        method: "DELETE",
      });
      return readApiResponse<{ leftOwnerId: string }>(res);
    },
    onSuccess: ({ leftOwnerId }) => {
      queryClient.setQueryData<SharedGuidesOverviewResponse>(
        sharedGuideQueryKeys.overview,
        (prev) =>
          prev
            ? {
                ...prev,
                sharedWithMe: prev.sharedWithMe.filter((item) => item.ownerId !== leftOwnerId),
              }
            : prev,
      );
      queryClient.removeQueries({ queryKey: sharedGuideQueryKeys.detail(leftOwnerId) });
      void queryClient.invalidateQueries({ queryKey: sharedGuideQueryKeys.overview });
    },
  });
}

export function useSaveSharedGuideSpotMutation(ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceRestaurantId: string) => {
      const res = await fetch(`/api/shared-guides/${encodeURIComponent(ownerId)}/save-place`, {
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
      queryClient.setQueryData<SharedLibraryGuideDetailResponse>(
        sharedGuideQueryKeys.detail(ownerId),
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
