import { describe, expect, it } from "vitest";

import { autocompleteQuerySchema, createRestaurantSchema, resolveUrlSchema } from "./places";

describe("places validation schemas", () => {
  it("validates resolve URL payload", () => {
    expect(resolveUrlSchema.safeParse({ url: "https://maps.app.goo.gl/abc" }).success).toBe(true);
    expect(resolveUrlSchema.safeParse({ url: "   " }).success).toBe(false);
  });

  it("requires at least 3 chars for autocomplete query", () => {
    expect(autocompleteQuerySchema.safeParse({ q: "ab" }).success).toBe(false);
    expect(
      autocompleteQuerySchema.safeParse({
        q: "Tartine",
        lat: "37.76",
        lng: "-122.42",
      }).success,
    ).toBe(true);
  });

  it("validates restaurant save payload boundaries", () => {
    const valid = createRestaurantSchema.safeParse({
      googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
      name: "Tartine Bakery",
      cuisines: ["Bakery", "Café"],
      priceLevel: 2,
      status: "to_try",
      ratingHalf: 9,
      notes: "Morning bun at 9am",
    });
    expect(valid.success).toBe(true);

    const invalidPrice = createRestaurantSchema.safeParse({
      googlePlaceId: "ChIJBVY2Bxh-j4ARa2zO8Jd6H2A",
      name: "Tartine Bakery",
      priceLevel: 5,
    });
    expect(invalidPrice.success).toBe(false);
  });
});
