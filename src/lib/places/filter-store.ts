"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_LIBRARY_FILTERS, type LibraryFilters } from "@/lib/places/facets";
import { serializeFiltersToSearchParams } from "@/lib/places/filter-state";

type Listener = () => void;

const listeners = new Set<Listener>();
let currentSharedFilters: LibraryFilters = DEFAULT_LIBRARY_FILTERS;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getSharedFilters(): LibraryFilters {
  return currentSharedFilters;
}

export function setSharedFilters(next: LibraryFilters) {
  const prevSerialized = serializeFiltersToSearchParams(currentSharedFilters).toString();
  const nextSerialized = serializeFiltersToSearchParams(next).toString();
  if (prevSerialized === nextSerialized) return;
  currentSharedFilters = next;
  emit();
}

export function useSharedFilters(): LibraryFilters {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSharedFilters,
    () => DEFAULT_LIBRARY_FILTERS,
  );
}

export function buildFilteredHref(basePath: string, filters: LibraryFilters): string {
  const params = serializeFiltersToSearchParams(filters);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
