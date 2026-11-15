import { describe, expect, it } from "vitest";

import {
  autocompleteQuerySchema,
  createRestaurantSchema,
  resolveUrlSchema,
  updateRestaurantSchema,
  uuidParamSchema,
} from "./places";

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

  it("validates partial updates and UUID parameters", () => {
    expect(uuidParamSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidParamSchema.safeParse("259957a2-ae04-4966-aa2f-23991b9beab0").success).toBe(true);

    expect(updateRestaurantSchema.safeParse({}).success).toBe(false);
    expect(
      updateRestaurantSchema.safeParse({
        city: "New York",
        cuisines: ["Pizza"],
        status: "tried",
        ratingHalf: 9,
      }).success,
    ).toBe(true);
  });
});
