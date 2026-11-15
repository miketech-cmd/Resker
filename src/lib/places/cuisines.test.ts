import { describe, expect, it } from "vitest";

import {
  formatPriceLevel,
  mapCuisinesToFoodIcon,
  mapGooglePriceLevel,
  mapGoogleTypesToCuisines,
} from "./cuisines";

describe("cuisine and price mappings", () => {
  it("maps Google primaryType and types to clean culinary labels", () => {
    expect(mapGoogleTypesToCuisines("italian_restaurant", ["restaurant", "food"])).toEqual([
      "Italian",
    ]);
    expect(
      mapGoogleTypesToCuisines("bakery", ["cafe", "breakfast_restaurant", "restaurant"]),
    ).toEqual(["Bakery", "Café", "Breakfast"]);
  });

  it("falls back to Restaurant when no specific type matches", () => {
    expect(mapGoogleTypesToCuisines("establishment", ["point_of_interest"])).toEqual([
      "Restaurant",
    ]);
    expect(mapGoogleTypesToCuisines(null, null)).toEqual(["Restaurant"]);
  });

  it("maps price levels and formats dollar signs", () => {
    expect(mapGooglePriceLevel("PRICE_LEVEL_INEXPENSIVE")).toBe(1);
    expect(mapGooglePriceLevel("PRICE_LEVEL_MODERATE")).toBe(2);
    expect(mapGooglePriceLevel("PRICE_LEVEL_EXPENSIVE")).toBe(3);
    expect(mapGooglePriceLevel("PRICE_LEVEL_VERY_EXPENSIVE")).toBe(4);
    expect(mapGooglePriceLevel("UNKNOWN")).toBeNull();

    expect(formatPriceLevel(2)).toBe("$$");
    expect(formatPriceLevel(null)).toBeNull();
  });

  it("matches cuisines to custom food icons", () => {
    expect(mapCuisinesToFoodIcon(["Ramen", "Japanese"])).toBe("noodles");
    expect(mapCuisinesToFoodIcon(["Pizza"])).toBe("pizza");
    expect(mapCuisinesToFoodIcon(["Café", "Bakery"])).toBe("coffee");
    expect(mapCuisinesToFoodIcon(["Unknown"])).toBe("bowl");
  });
});
