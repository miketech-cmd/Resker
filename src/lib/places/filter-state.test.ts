import { describe, expect, it } from "vitest";

import { DEFAULT_LIBRARY_FILTERS } from "@/lib/places/facets";
import {
  clearAllLibraryFilters,
  countActiveSheetFilters,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
  toggleFacetValue,
} from "@/lib/places/filter-state";

describe("filter-state", () => {
  it("round-trips facet filters, grouping, rating, and sort via URLSearchParams", () => {
    const existing = new URLSearchParams("highlight=abc-123");
    const state = {
      ...DEFAULT_LIBRARY_FILTERS,
      q: "ramen",
      facets: {
        city: ["tokyo", "san francisco"],
        cuisine: ["ramen"],
        price: ["2"],
        status: ["tried"],
      },
      minRatingHalf: 8,
      groupBy: "city" as const,
      groupSort: "alpha_asc" as const,
      sort: "rating_desc" as const,
    };

    const params = serializeFiltersToSearchParams(state, existing);
    expect(params.get("highlight")).toBe("abc-123");
    expect(params.get("city")).toBe("tokyo,san francisco");
    expect(params.get("group")).toBe("city");

    const parsed = parseFiltersFromSearchParams(params);
    expect(parsed).toEqual(state);
  });

  it("ignores invalid sort/group values cleanly", () => {
    const parsed = parseFiltersFromSearchParams(
      new URLSearchParams("group=bogus&sort=unknown&minRating=99"),
    );
    expect(parsed).toEqual(DEFAULT_LIBRARY_FILTERS);
  });

  it("toggles facet selections and counts sheet filters accurately", () => {
    let next = toggleFacetValue(DEFAULT_LIBRARY_FILTERS, "city", "Tokyo");
    next = toggleFacetValue(next, "cuisine", "Ramen");
    next = toggleFacetValue(next, "status", "tried");

    expect(countActiveSheetFilters(next, { excludeFacets: ["status"] })).toBe(2);

    next = toggleFacetValue(next, "city", "tokyo");
    expect(next.facets.city).toBeUndefined();

    const cleared = clearAllLibraryFilters({ ...next, groupBy: "cuisine" });
    expect(cleared.facets).toEqual({});
    expect(cleared.groupBy).toBe("cuisine");
  });
});
