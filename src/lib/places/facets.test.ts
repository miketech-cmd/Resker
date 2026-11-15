import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIBRARY_FILTERS,
  EMPTY_FACET_KEY,
  extractFacetOptions,
  filterAndSortRestaurants,
  groupRestaurantsByFacet,
  suggestFacetsForQuery,
  type LibraryFilters,
} from "@/lib/places/facets";
import type { UserRestaurantItem } from "@/lib/queries/restaurants";

function makeRestaurant(
  overrides: Partial<UserRestaurantItem> & { id: string; name: string },
): UserRestaurantItem {
  return {
    placeId: `place-${overrides.id}`,
    googlePlaceId: `ChIJ${overrides.id.padEnd(10, "0")}`,
    googleMapsUri: null,
    lat: 37.76,
    lng: -122.42,
    address: "123 Market St",
    city: "San Francisco",
    countryCode: "US",
    cuisines: ["Ramen"],
    priceLevel: 2,
    status: "to_try",
    ratingHalf: null,
    notes: null,
    visitCount: 0,
    lastVisitedOn: null,
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

const SAMPLE_ITEMS: UserRestaurantItem[] = [
  makeRestaurant({
    id: "1",
    name: "Tartine Bakery",
    city: "San Francisco",
    countryCode: "US",
    cuisines: ["Bakery", "Café"],
    priceLevel: 2,
    status: "tried",
    ratingHalf: 9,
    updatedAt: "2026-11-14T10:00:00.000Z",
  }),
  makeRestaurant({
    id: "2",
    name: "Bi-Rite Creamery",
    city: " san francisco ",
    countryCode: "US",
    cuisines: ["Ice Cream", "Dessert"],
    priceLevel: 1,
    status: "to_try",
    ratingHalf: 8,
    updatedAt: "2026-11-13T10:00:00.000Z",
  }),
  makeRestaurant({
    id: "3",
    name: "Nari",
    city: "San Francisco",
    countryCode: "US",
    cuisines: ["Thai"],
    priceLevel: 4,
    status: "exploration",
    ratingHalf: 10,
    notes: "Incredible squid and curry",
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
  makeRestaurant({
    id: "4",
    name: "Fuunji",
    city: "Tokyo",
    countryCode: "JP",
    cuisines: ["Ramen", "Noodles"],
    priceLevel: 1,
    status: "tried",
    ratingHalf: 10,
    updatedAt: "2026-11-11T10:00:00.000Z",
  }),
  makeRestaurant({
    id: "5",
    name: "Secret Pop-Up",
    city: null,
    countryCode: null,
    cuisines: ["Restaurant"],
    priceLevel: null,
    status: "to_try",
    updatedAt: "2026-11-09T10:00:00.000Z",
  }),
];

describe("facets engine", () => {
  it("normalizes whitespace and case when extracting city options", () => {
    const cities = extractFacetOptions(SAMPLE_ITEMS, "city");
    expect(cities.map((c) => ({ key: c.key, count: c.count }))).toEqual([
      { key: "san francisco", count: 3 },
      { key: "tokyo", count: 1 },
    ]);
    expect(cities[0]?.label).toBe("San Francisco");
  });

  it("groups by city cleanly with empty cities placed last", () => {
    const groups = groupRestaurantsByFacet(SAMPLE_ITEMS, "city", "count_desc");
    expect(groups.map((g) => g.key)).toEqual(["san francisco", "tokyo", EMPTY_FACET_KEY]);
    expect(groups[0]?.items.map((i) => i.name)).toEqual([
      "Tartine Bakery",
      "Bi-Rite Creamery",
      "Nari",
    ]);
    expect(groups[2]?.label).toBe("No city");

    const alphaGroups = groupRestaurantsByFacet(SAMPLE_ITEMS, "city", "alpha_asc");
    expect(alphaGroups.map((g) => g.key)).toEqual(["san francisco", "tokyo", EMPTY_FACET_KEY]);
  });

  it("groups multi-cuisine items into each matching section and excludes generic fallback", () => {
    const groups = groupRestaurantsByFacet(SAMPLE_ITEMS, "cuisine", "alpha_asc");
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("bakery");
    expect(keys).toContain("café");
    expect(keys).not.toContain("restaurant");
    expect(keys.at(-1)).toBe(EMPTY_FACET_KEY);

    const bakeryGroup = groups.find((g) => g.key === "bakery");
    const cafeGroup = groups.find((g) => g.key === "café");
    expect(bakeryGroup?.items.map((i) => i.id)).toEqual(["1"]);
    expect(cafeGroup?.items.map((i) => i.id)).toEqual(["1"]);
  });

  it("filters uniformly across registered facets (city, cuisine, country, price, status, rating, query)", () => {
    const filters: LibraryFilters = {
      ...DEFAULT_LIBRARY_FILTERS,
      q: "curry",
      facets: {
        city: ["san francisco"],
        cuisine: ["thai"],
        price: ["4"],
        country: ["us"],
        status: ["exploration"],
      },
      minRatingHalf: 9,
    };

    const matched = filterAndSortRestaurants(SAMPLE_ITEMS, filters);
    expect(matched.map((item) => item.id)).toEqual(["3"]);
  });

  it("surfaces quick facet filter suggestions across searchable dimensions", () => {
    const citySuggestions = suggestFacetsForQuery(SAMPLE_ITEMS, "tok", {});
    expect(citySuggestions).toEqual([
      {
        facetId: "city",
        facetLabel: "City",
        key: "tokyo",
        label: "Tokyo",
        count: 1,
      },
    ]);

    const cuisineSuggestions = suggestFacetsForQuery(SAMPLE_ITEMS, "bak", {});
    expect(cuisineSuggestions[0]?.facetId).toBe("cuisine");
    expect(cuisineSuggestions[0]?.label).toBe("Bakery");
  });

  it("filters and groups 500 items well under 50ms", () => {
    const cities = ["San Francisco", "Tokyo", "New York", "London", "Paris", "Seoul"];
    const cuisines = ["Ramen", "Italian", "Bakery", "Café", "Sushi", "Tacos", "Thai"];
    const dataset: UserRestaurantItem[] = Array.from({ length: 500 }, (_, i) =>
      makeRestaurant({
        id: String(i),
        name: `Restaurant ${i}`,
        city: cities[i % cities.length] ?? "San Francisco",
        cuisines: [
          cuisines[i % cuisines.length] ?? "Ramen",
          cuisines[(i + 2) % cuisines.length] ?? "Café",
        ],
        priceLevel: ((i % 4) + 1) as 1 | 2 | 3 | 4,
        status: i % 3 === 0 ? "tried" : i % 3 === 1 ? "to_try" : "exploration",
        ratingHalf: (i % 10) + 1,
      }),
    );

    const start = performance.now();
    const filtered = filterAndSortRestaurants(dataset, {
      ...DEFAULT_LIBRARY_FILTERS,
      facets: { city: ["tokyo", "san francisco"] },
      sort: "rating_desc",
    });
    const grouped = groupRestaurantsByFacet(filtered, "cuisine", "count_desc");
    const elapsed = performance.now() - start;

    expect(filtered.length).toBeGreaterThan(150);
    expect(grouped.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});
