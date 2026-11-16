"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { toast } from "@/components/ui/toast";
import { listQueryKeys } from "@/lib/queries/lists";
import { planQueryKeys } from "@/lib/queries/plans";
import { restaurantQueryKeys, type UserRestaurantItem } from "@/lib/queries/restaurants";

const UNDO_DELAY_MS = 5000;

interface PendingDeleteEntry {
  item: UserRestaurantItem;
  timerId: number;
  queryClient: QueryClient;
}

const pendingDeletes = new Map<string, PendingDeleteEntry>();
const listeners = new Set<() => void>();
let snapshotIds = new Set<string>();
let unloadListenerAttached = false;

function notifyListeners() {
  snapshotIds = new Set(pendingDeletes.keys());
  for (const listener of listeners) {
    listener();
  }
}

function flushSinglePendingDelete(id: string) {
  const entry = pendingDeletes.get(id);
  if (!entry) return;
  window.clearTimeout(entry.timerId);
  pendingDeletes.delete(id);
  notifyListeners();

  void fetch(`/api/restaurants/${encodeURIComponent(id)}`, {
    method: "DELETE",
    keepalive: true,
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error("Could not remove spot from server.");
      }
      void entry.queryClient.invalidateQueries({ queryKey: restaurantQueryKeys.all });
      void entry.queryClient.invalidateQueries({ queryKey: listQueryKeys.all });
      void entry.queryClient.invalidateQueries({ queryKey: planQueryKeys.all });
    })
    .catch((err) => {
      restoreRestaurantIntoCache(entry.item, entry.queryClient);
      toast.error(err instanceof Error ? err.message : "Could not remove spot.");
    });
}

function attachUnloadFlushListener() {
  if (unloadListenerAttached || typeof window === "undefined") return;
  unloadListenerAttached = true;

  const flushAll = () => {
    for (const id of Array.from(pendingDeletes.keys())) {
      const entry = pendingDeletes.get(id);
      if (!entry) continue;
      window.clearTimeout(entry.timerId);
      pendingDeletes.delete(id);
      void fetch(`/api/restaurants/${encodeURIComponent(id)}`, {
        method: "DELETE",
        keepalive: true,
      });
    }
  };

  window.addEventListener("pagehide", flushAll);
}

function restoreRestaurantIntoCache(item: UserRestaurantItem, queryClient: QueryClient) {
  queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) => {
    if (!prev) return [item];
    if (prev.some((existing) => existing.id === item.id)) return prev;
    return [item, ...prev];
  });
  queryClient.setQueryData(restaurantQueryKeys.detail(item.id), item);
}

export function scheduleRestaurantDelete({
  restaurant,
  queryClient,
  onUndo,
  delayMs = UNDO_DELAY_MS,
}: {
  restaurant: UserRestaurantItem;
  queryClient: QueryClient;
  onUndo?: (restored: UserRestaurantItem) => void;
  delayMs?: number;
}) {
  const existing = pendingDeletes.get(restaurant.id);
  if (existing) {
    window.clearTimeout(existing.timerId);
  }

  attachUnloadFlushListener();

  queryClient.setQueryData<UserRestaurantItem[]>(restaurantQueryKeys.all, (prev) =>
    prev?.filter((item) => item.id !== restaurant.id),
  );

  const timerId = window.setTimeout(() => {
    flushSinglePendingDelete(restaurant.id);
  }, delayMs);

  pendingDeletes.set(restaurant.id, {
    item: restaurant,
    timerId,
    queryClient,
  });
  notifyListeners();

  toast(`Removed ${restaurant.name}`, {
    id: `undo-delete-${restaurant.id}`,
    duration: delayMs,
    action: {
      label: "Undo",
      onClick: () => undoRestaurantDelete(restaurant.id, onUndo),
    },
  });
}

export function undoRestaurantDelete(id: string, onUndo?: (restored: UserRestaurantItem) => void) {
  const entry = pendingDeletes.get(id);
  if (!entry) return;

  window.clearTimeout(entry.timerId);
  pendingDeletes.delete(id);
  notifyListeners();

  restoreRestaurantIntoCache(entry.item, entry.queryClient);
  toast(`Restored ${entry.item.name}`, { id: `undo-delete-${id}` });
  onUndo?.(entry.item);
}

const EMPTY_SET = new Set<string>();

export function usePendingDeleteIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshotIds,
    () => EMPTY_SET,
  );
}

export function resetPendingDeletesForTests() {
  for (const entry of pendingDeletes.values()) {
    window.clearTimeout(entry.timerId);
  }
  pendingDeletes.clear();
  notifyListeners();
}
