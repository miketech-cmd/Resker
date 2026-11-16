"use client";

import { useCallback, useSyncExternalStore } from "react";

export type PlacesDensity = "comfortable" | "compact";

export const PLACES_DENSITY_STORAGE_KEY = "resker:places-density";

const listeners = new Set<() => void>();

function readStoredDensity(): PlacesDensity {
  if (typeof window === "undefined") return "comfortable";
  try {
    const raw = window.localStorage.getItem(PLACES_DENSITY_STORAGE_KEY);
    return raw === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

function subscribeDensity(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PLACES_DENSITY_STORAGE_KEY) {
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function setPlacesDensity(next: PlacesDensity): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PLACES_DENSITY_STORAGE_KEY, next);
    } catch {
      // Ignore storage quota / private mode failures
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

export function usePlacesDensity(): [PlacesDensity, (next: PlacesDensity) => void] {
  const density = useSyncExternalStore(
    subscribeDensity,
    readStoredDensity,
    () => "comfortable" as PlacesDensity,
  );
  const update = useCallback((next: PlacesDensity) => {
    setPlacesDensity(next);
  }, []);
  return [density, update];
}
