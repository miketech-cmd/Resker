import {
  DEFAULT_LIBRARY_FILTERS,
  FACET_DEFINITIONS,
  FACET_REGISTRY,
  GROUPABLE_FACET_IDS,
  normalizeFacetKey,
  type FacetId,
  type GroupByOption,
  type GroupSortOption,
  type LibraryFilters,
  type SortOption,
} from "@/lib/places/facets";

const VALID_SORTS = new Set<SortOption>(["updated_desc", "rating_desc", "name_asc", "city_asc"]);
const VALID_GROUP_SORTS = new Set<GroupSortOption>(["count_desc", "alpha_asc"]);
const VALID_GROUP_BY = new Set<GroupByOption>(["none", ...GROUPABLE_FACET_IDS]);

function parseCsvParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const key = normalizeFacetKey(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function parseFiltersFromSearchParams(params: URLSearchParams): LibraryFilters {
  const facets: Partial<Record<FacetId, string[]>> = {};

  for (const def of FACET_DEFINITIONS) {
    if (!def.supportsFilter) continue;
    const values = parseCsvParam(params.get(def.urlParam));
    if (values.length > 0) {
      facets[def.id] = values;
    }
  }

  const rawMinRating = params.get("minRating");
  const parsedRating = rawMinRating ? Number(rawMinRating) : NaN;
  const minRatingHalf =
    Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 10 ? parsedRating : null;

  const rawGroup = params.get("group") as GroupByOption | null;
  const groupBy: GroupByOption = rawGroup && VALID_GROUP_BY.has(rawGroup) ? rawGroup : "none";

  const rawGroupSort = params.get("groupSort") as GroupSortOption | null;
  const groupSort: GroupSortOption =
    rawGroupSort && VALID_GROUP_SORTS.has(rawGroupSort) ? rawGroupSort : "count_desc";

  const rawSort = params.get("sort") as SortOption | null;
  const sort: SortOption = rawSort && VALID_SORTS.has(rawSort) ? rawSort : "updated_desc";

  return {
    q: params.get("q") ?? "",
    facets,
    minRatingHalf,
    groupBy,
    groupSort,
    sort,
  };
}

/**
 * Serializes `LibraryFilters` into URLSearchParams while preserving unrelated params
 * (such as `highlight`, `add`, or `filter`).
 */
export function serializeFiltersToSearchParams(
  filters: LibraryFilters,
  existing?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(existing ? existing.toString() : undefined);

  const trimmedQ = filters.q.trim();
  if (trimmedQ) {
    next.set("q", trimmedQ);
  } else {
    next.delete("q");
  }

  for (const def of FACET_DEFINITIONS) {
    if (!def.supportsFilter) continue;
    const selected = filters.facets[def.id];
    if (selected && selected.length > 0) {
      next.set(def.urlParam, selected.join(","));
    } else {
      next.delete(def.urlParam);
    }
  }

  if (filters.minRatingHalf !== null) {
    next.set("minRating", String(filters.minRatingHalf));
  } else {
    next.delete("minRating");
  }

  if (filters.groupBy !== "none") {
    next.set("group", filters.groupBy);
  } else {
    next.delete("group");
  }

  if (filters.groupSort !== "count_desc") {
    next.set("groupSort", filters.groupSort);
  } else {
    next.delete("groupSort");
  }

  if (filters.sort !== "updated_desc") {
    next.set("sort", filters.sort);
  } else {
    next.delete("sort");
  }

  return next;
}

export function toggleFacetValue(
  filters: LibraryFilters,
  facetId: FacetId,
  rawKey: string,
): LibraryFilters {
  const key = normalizeFacetKey(rawKey);
  if (!key) return filters;

  const existing = filters.facets[facetId] ?? [];
  const exists = existing.includes(key);
  const nextList = exists ? existing.filter((item) => item !== key) : [...existing, key];

  const nextFacets = { ...filters.facets };
  if (nextList.length > 0) {
    nextFacets[facetId] = nextList;
  } else {
    delete nextFacets[facetId];
  }

  return {
    ...filters,
    facets: nextFacets,
  };
}

export function setSingleFacetValue(
  filters: LibraryFilters,
  facetId: FacetId,
  rawKey: string | null,
): LibraryFilters {
  const nextFacets = { ...filters.facets };
  if (!rawKey) {
    delete nextFacets[facetId];
  } else {
    nextFacets[facetId] = [normalizeFacetKey(rawKey)];
  }
  return {
    ...filters,
    facets: nextFacets,
  };
}

export function clearAllLibraryFilters(current?: LibraryFilters): LibraryFilters {
  return {
    ...DEFAULT_LIBRARY_FILTERS,
    facets: {},
    groupBy: current?.groupBy ?? "none",
    groupSort: current?.groupSort ?? "count_desc",
  };
}

export function countActiveSheetFilters(
  filters: LibraryFilters,
  options?: { excludeFacets?: readonly FacetId[] },
): number {
  const excluded = new Set(options?.excludeFacets ?? []);
  let count = 0;

  for (const def of FACET_DEFINITIONS) {
    if (excluded.has(def.id)) continue;
    count += filters.facets[def.id]?.length ?? 0;
  }

  if (filters.minRatingHalf !== null) {
    count += 1;
  }

  if (filters.sort !== "updated_desc") {
    count += 1;
  }

  return count;
}

export function getActiveFacetChips(filters: LibraryFilters, labelLookup: Map<string, string>) {
  const chips: Array<{ facetId: FacetId; facetLabel: string; key: string; label: string }> = [];
  for (const def of FACET_DEFINITIONS) {
    if (def.id === "status") continue;
    for (const key of filters.facets[def.id] ?? []) {
      chips.push({
        facetId: def.id,
        facetLabel: FACET_REGISTRY[def.id].label,
        key,
        label: labelLookup.get(`${def.id}:${key}`) ?? key,
      });
    }
  }
  return chips;
}
