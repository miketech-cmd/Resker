import type { FoodIconKey } from "@/components/icons/food-icons";
import { formatPriceLevel, mapCuisinesToFoodIcon } from "@/lib/places/cuisines";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";
import { RESTAURANT_STATUSES, STATUS_LABELS } from "@/lib/validation/places";

export const FACET_IDS = ["city", "cuisine", "price", "status", "country"] as const;
export type FacetId = (typeof FACET_IDS)[number];

export type GroupByOption = "none" | FacetId;
export type GroupSortOption = "count_desc" | "alpha_asc";
export type SortOption = "updated_desc" | "rating_desc" | "name_asc" | "city_asc";

export const EMPTY_FACET_KEY = "__none__";

export interface FacetValue {
  key: string;
  label: string;
  subtitle?: string;
  iconKey?: FoodIconKey;
}

export interface FacetOption {
  facetId: FacetId;
  key: string;
  label: string;
  subtitle?: string;
  iconKey?: FoodIconKey;
  count: number;
}

export interface FacetDefinition<TId extends FacetId = FacetId> {
  id: TId;
  label: string;
  pluralLabel: string;
  urlParam: string;
  searchable: boolean;
  supportsFilter: boolean;
  supportsGrouping: boolean;
  supportsGroupSort: boolean;
  emptyGroupLabel: string;
  emptySearchFilterMinCount?: number;
  extractValues: (item: UserRestaurantItem) => FacetValue[];
  compareOptions?: (a: FacetOption, b: FacetOption) => number;
}

export interface LibraryFilters {
  q: string;
  facets: Partial<Record<FacetId, string[]>>;
  listIds: string[];
  minRatingHalf: number | null;
  groupBy: GroupByOption;
  groupSort: GroupSortOption;
  sort: SortOption;
}

export interface ListFilterMembership {
  id: string;
  restaurantIds: readonly string[];
  placeIds?: readonly string[];
}

export interface FacetGroup {
  key: string;
  label: string;
  subtitle?: string;
  iconKey?: FoodIconKey;
  isEmptyBucket: boolean;
  items: UserRestaurantItem[];
}

export interface QuickFacetSuggestion {
  facetId: FacetId;
  facetLabel: string;
  key: string;
  label: string;
  count: number;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  q: "",
  facets: {},
  listIds: [],
  minRatingHalf: null,
  groupBy: "none",
  groupSort: "count_desc",
  sort: "updated_desc",
};

export function normalizeFacetKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

const GENERIC_CUISINE_KEYS = new Set(["restaurant"]);

const STATUS_ORDER_MAP = new Map<string, number>(
  RESTAURANT_STATUSES.map((status, index) => [status, index]),
);

/**
 * Declarative registry of every filterable and groupable dimension.
 * Adding support for another attribute (e.g. neighborhood, list, dietary tag)
 * requires registering one descriptor here — filtering, counting, grouping,
 * URL serialization, and filter-sheet rendering adapt automatically.
 */
export const FACET_REGISTRY: Record<FacetId, FacetDefinition> = {
  city: {
    id: "city",
    label: "City",
    pluralLabel: "Cities",
    urlParam: "city",
    searchable: true,
    supportsFilter: true,
    supportsGrouping: true,
    supportsGroupSort: true,
    emptyGroupLabel: "No city",
    extractValues(item) {
      const clean = item.city?.trim();
      if (!clean) return [];
      return [
        {
          key: normalizeFacetKey(clean),
          label: clean,
          subtitle: item.countryCode?.trim() || undefined,
        },
      ];
    },
  },
  cuisine: {
    id: "cuisine",
    label: "Cuisine",
    pluralLabel: "Cuisines",
    urlParam: "cuisine",
    searchable: true,
    supportsFilter: true,
    supportsGrouping: true,
    supportsGroupSort: true,
    emptyGroupLabel: "Other",
    extractValues(item) {
      const seen = new Set<string>();
      const values: FacetValue[] = [];
      for (const rawTag of item.cuisines) {
        const label = rawTag.trim();
        const key = normalizeFacetKey(label);
        if (!key || GENERIC_CUISINE_KEYS.has(key) || seen.has(key)) continue;
        seen.add(key);
        values.push({
          key,
          label,
          iconKey: mapCuisinesToFoodIcon([label]),
        });
      }
      return values;
    },
  },
  price: {
    id: "price",
    label: "Price",
    pluralLabel: "Price range",
    urlParam: "price",
    searchable: false,
    supportsFilter: true,
    supportsGrouping: true,
    supportsGroupSort: false,
    emptyGroupLabel: "No price",
    extractValues(item) {
      const label = formatPriceLevel(item.priceLevel);
      if (!label || !item.priceLevel) return [];
      return [
        {
          key: String(item.priceLevel),
          label,
        },
      ];
    },
    compareOptions(a, b) {
      return Number(a.key) - Number(b.key);
    },
  },
  status: {
    id: "status",
    label: "Status",
    pluralLabel: "Status",
    urlParam: "status",
    searchable: false,
    supportsFilter: true,
    supportsGrouping: true,
    supportsGroupSort: false,
    emptyGroupLabel: "Other",
    extractValues(item) {
      return [
        {
          key: item.status,
          label: STATUS_LABELS[item.status],
        },
      ];
    },
    compareOptions(a, b) {
      return (STATUS_ORDER_MAP.get(a.key) ?? 99) - (STATUS_ORDER_MAP.get(b.key) ?? 99);
    },
  },
  country: {
    id: "country",
    label: "Country",
    pluralLabel: "Countries",
    urlParam: "country",
    searchable: true,
    supportsFilter: true,
    supportsGrouping: true,
    supportsGroupSort: true,
    emptyGroupLabel: "No country",
    emptySearchFilterMinCount: 2,
    extractValues(item) {
      const clean = item.countryCode?.trim().toUpperCase();
      if (!clean) return [];
      return [
        {
          key: clean.toLowerCase(),
          label: clean,
        },
      ];
    },
  },
};

export const FACET_DEFINITIONS = FACET_IDS.map((id) => FACET_REGISTRY[id]);
export const FILTERABLE_FACET_IDS = FACET_IDS.filter((id) => FACET_REGISTRY[id].supportsFilter);
export const GROUPABLE_FACET_IDS = FACET_IDS.filter((id) => FACET_REGISTRY[id].supportsGrouping);
export const SEARCHABLE_FACET_IDS = FACET_IDS.filter((id) => FACET_REGISTRY[id].searchable);

function matchesTextQuery(item: UserRestaurantItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  if (item.name.toLowerCase().includes(normalizedQuery)) return true;
  if (item.city?.toLowerCase().includes(normalizedQuery)) return true;
  if (item.countryCode?.toLowerCase().includes(normalizedQuery)) return true;
  if (item.address?.toLowerCase().includes(normalizedQuery)) return true;
  if (item.notes?.toLowerCase().includes(normalizedQuery)) return true;
  return item.cuisines.some((tag) => tag.toLowerCase().includes(normalizedQuery));
}

export interface ListMatchSets {
  restaurantIds: Set<string>;
  placeIds: Set<string>;
}

export function buildListMatchSets(
  lists: readonly ListFilterMembership[],
  listIds: readonly string[],
): ListMatchSets | null {
  if (listIds.length === 0) return null;
  const targetIds = new Set(listIds);
  const restaurantIds = new Set<string>();
  const placeIds = new Set<string>();
  for (const list of lists) {
    if (!targetIds.has(list.id)) continue;
    for (const rId of list.restaurantIds) {
      restaurantIds.add(rId);
    }
    if (list.placeIds) {
      for (const pId of list.placeIds) {
        placeIds.add(pId);
      }
    }
  }
  return { restaurantIds, placeIds };
}

export function matchesLibraryFilters(
  item: UserRestaurantItem,
  filters: LibraryFilters,
  options?: {
    excludeFacetId?: FacetId;
    excludeListFilter?: boolean;
    lists?: readonly ListFilterMembership[];
    listSets?: ListMatchSets | null;
  },
): boolean {
  const normalizedQuery = filters.q.trim().toLowerCase();
  if (normalizedQuery && !matchesTextQuery(item, normalizedQuery)) {
    return false;
  }

  if (filters.minRatingHalf !== null && (item.ratingHalf ?? 0) < filters.minRatingHalf) {
    return false;
  }

  if (!options?.excludeListFilter && filters.listIds.length > 0) {
    const sets =
      options?.listSets ??
      (options?.lists !== undefined ? buildListMatchSets(options.lists, filters.listIds) : null);
    if (sets && !sets.restaurantIds.has(item.id) && !sets.placeIds.has(item.placeId)) {
      return false;
    }
  }

  for (const facetId of FILTERABLE_FACET_IDS) {
    if (options?.excludeFacetId === facetId) continue;
    const selectedKeys = filters.facets[facetId];
    if (!selectedKeys || selectedKeys.length === 0) continue;

    const itemValues = FACET_REGISTRY[facetId].extractValues(item);
    const hasMatch = itemValues.some((val) => selectedKeys.includes(val.key));
    if (!hasMatch) {
      return false;
    }
  }

  return true;
}

export function sortRestaurants(
  items: readonly UserRestaurantItem[],
  sort: SortOption,
): UserRestaurantItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (sort) {
      case "rating_desc": {
        const diff = (b.ratingHalf ?? -1) - (a.ratingHalf ?? -1);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "city_asc": {
        const cityA = a.city?.trim() || "\uffff";
        const cityB = b.city?.trim() || "\uffff";
        const diff = cityA.localeCompare(cityB);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      case "updated_desc":
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
  return copy;
}

export function filterAndSortRestaurants(
  items: readonly UserRestaurantItem[],
  filters: LibraryFilters,
  options?: { lists?: readonly ListFilterMembership[] },
): UserRestaurantItem[] {
  const listSets =
    options?.lists !== undefined ? buildListMatchSets(options.lists, filters.listIds) : null;
  const filtered = items.filter((item) =>
    matchesLibraryFilters(item, filters, { lists: options?.lists, listSets }),
  );
  return sortRestaurants(filtered, filters.sort);
}

interface OptionAccumulator {
  count: number;
  labelCounts: Map<string, number>;
  subtitle?: string;
  iconKey?: FoodIconKey;
}

function resolveMostCommonLabel(labelCounts: Map<string, number>): string {
  let bestLabel = "";
  let bestCount = -1;
  for (const [label, count] of labelCounts) {
    if (count > bestCount) {
      bestLabel = label;
      bestCount = count;
    }
  }
  return bestLabel;
}

/**
 * Extracts normalized options and item counts for any registered facet.
 * Pass `filters` with `excludeSelf: true` to cross-filter counts accurately against
 * the user's other active selections.
 */
export function extractFacetOptions(
  items: readonly UserRestaurantItem[],
  facetId: FacetId,
  options?: {
    filters?: LibraryFilters;
    excludeSelf?: boolean;
    lists?: readonly ListFilterMembership[];
  },
): FacetOption[] {
  const definition = FACET_REGISTRY[facetId];
  const buckets = new Map<string, OptionAccumulator>();
  const listSets =
    options?.filters && options?.lists !== undefined
      ? buildListMatchSets(options.lists, options.filters.listIds)
      : null;

  for (const item of items) {
    if (
      options?.filters &&
      !matchesLibraryFilters(item, options.filters, {
        excludeFacetId: options.excludeSelf ? facetId : undefined,
        lists: options.lists,
        listSets,
      })
    ) {
      continue;
    }

    const values = definition.extractValues(item);
    for (const value of values) {
      let bucket = buckets.get(value.key);
      if (!bucket) {
        bucket = {
          count: 0,
          labelCounts: new Map(),
          subtitle: value.subtitle,
          iconKey: value.iconKey,
        };
        buckets.set(value.key, bucket);
      }
      bucket.count += 1;
      bucket.labelCounts.set(value.label, (bucket.labelCounts.get(value.label) ?? 0) + 1);
      if (!bucket.subtitle && value.subtitle) bucket.subtitle = value.subtitle;
      if (!bucket.iconKey && value.iconKey) bucket.iconKey = value.iconKey;
    }
  }

  const extracted: FacetOption[] = Array.from(buckets.entries()).map(([key, bucket]) => ({
    facetId,
    key,
    label: resolveMostCommonLabel(bucket.labelCounts),
    subtitle: bucket.subtitle,
    iconKey: bucket.iconKey,
    count: bucket.count,
  }));

  extracted.sort((a, b) => {
    if (definition.compareOptions) {
      return definition.compareOptions(a, b);
    }
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });

  return extracted;
}

interface GroupAccumulator {
  key: string;
  labelCounts: Map<string, number>;
  subtitle?: string;
  iconKey?: FoodIconKey;
  isEmptyBucket: boolean;
  items: UserRestaurantItem[];
}

/**
 * Generic grouper for ANY facet registered in `FACET_REGISTRY`.
 * Multi-value facets (e.g. `cuisines[]`) cleanly include an item under each matching section.
 */
export function groupRestaurantsByFacet(
  items: readonly UserRestaurantItem[],
  facetId: FacetId,
  groupSort: GroupSortOption = "count_desc",
): FacetGroup[] {
  const definition = FACET_REGISTRY[facetId];
  const groups = new Map<string, GroupAccumulator>();

  const pushToGroup = (
    key: string,
    label: string,
    item: UserRestaurantItem,
    meta: { subtitle?: string; iconKey?: FoodIconKey; isEmptyBucket: boolean },
  ) => {
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        labelCounts: new Map(),
        subtitle: meta.subtitle,
        iconKey: meta.iconKey,
        isEmptyBucket: meta.isEmptyBucket,
        items: [],
      };
      groups.set(key, group);
    }
    group.labelCounts.set(label, (group.labelCounts.get(label) ?? 0) + 1);
    if (!group.subtitle && meta.subtitle) group.subtitle = meta.subtitle;
    if (!group.iconKey && meta.iconKey) group.iconKey = meta.iconKey;
    group.items.push(item);
  };

  for (const item of items) {
    const values = definition.extractValues(item);
    if (values.length === 0) {
      pushToGroup(EMPTY_FACET_KEY, definition.emptyGroupLabel, item, { isEmptyBucket: true });
      continue;
    }

    for (const val of values) {
      pushToGroup(val.key, val.label, item, {
        subtitle: val.subtitle,
        iconKey: val.iconKey,
        isEmptyBucket: false,
      });
    }
  }

  const resolved: FacetGroup[] = Array.from(groups.values()).map((group) => ({
    key: group.key,
    label: resolveMostCommonLabel(group.labelCounts),
    subtitle: group.subtitle,
    iconKey: group.iconKey,
    isEmptyBucket: group.isEmptyBucket,
    items: group.items,
  }));

  resolved.sort((a, b) => {
    if (a.isEmptyBucket !== b.isEmptyBucket) {
      return a.isEmptyBucket ? 1 : -1;
    }

    if (definition.compareOptions) {
      return definition.compareOptions(
        { facetId, key: a.key, label: a.label, count: a.items.length },
        { facetId, key: b.key, label: b.label, count: b.items.length },
      );
    }

    if (groupSort === "alpha_asc" || !definition.supportsGroupSort) {
      return a.label.localeCompare(b.label);
    }

    if (b.items.length !== a.items.length) {
      return b.items.length - a.items.length;
    }
    return a.label.localeCompare(b.label);
  });

  return resolved;
}

/**
 * Surfaces 1-tap quick-filter suggestions across all searchable facets when the user
 * types part of a city, cuisine, or country in the library search bar.
 */
export function suggestFacetsForQuery(
  items: readonly UserRestaurantItem[],
  query: string,
  activeFacets: Partial<Record<FacetId, string[]>>,
  limit = 4,
): QuickFacetSuggestion[] {
  const clean = normalizeFacetKey(query);
  if (clean.length < 2) return [];

  const suggestions: QuickFacetSuggestion[] = [];
  for (const facetId of SEARCHABLE_FACET_IDS) {
    const def = FACET_REGISTRY[facetId];
    const options = extractFacetOptions(items, facetId);
    const activeKeys = new Set(activeFacets[facetId] ?? []);
    for (const opt of options) {
      if (activeKeys.has(opt.key)) continue;
      if (opt.key.includes(clean)) {
        suggestions.push({
          facetId,
          facetLabel: def.label,
          key: opt.key,
          label: opt.label,
          count: opt.count,
        });
      }
    }
  }

  suggestions.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return suggestions.slice(0, limit);
}
