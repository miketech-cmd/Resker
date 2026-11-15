import { describe, expect, it } from "vitest";

import {
  clonePublicListSchema,
  createListSchema,
  listItemActionSchema,
  publicListsFilterSchema,
  reorderListItemSchema,
  savePublicSpotSchema,
  updateListSchema,
} from "@/lib/validation/lists";

describe("list validation schemas", () => {
  it("validates list creation with icon, public flag, and city", () => {
    const parsed = createListSchema.safeParse({
      name: "  NY 2026 Travel  ",
      description: "Late night ramen & pizza",
      icon: "noodles",
      isPublic: true,
      city: "  New York  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("NY 2026 Travel");
      expect(parsed.data.icon).toBe("noodles");
      expect(parsed.data.isPublic).toBe(true);
      expect(parsed.data.city).toBe("New York");
    }
  });

  it("validates public save-spot, clone, and browse filters", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(savePublicSpotSchema.safeParse({ sourceRestaurantId: id }).success).toBe(true);
    expect(savePublicSpotSchema.safeParse({ sourceRestaurantId: "not-a-uuid" }).success).toBe(
      false,
    );
    expect(clonePublicListSchema.safeParse({ name: "My Seattle Veg List" }).success).toBe(true);
    expect(clonePublicListSchema.safeParse({ name: "" }).success).toBe(false);
    expect(publicListsFilterSchema.safeParse({ q: "ramen", city: "Seattle" }).success).toBe(true);
  });

  it("rejects unknown icons or empty updates", () => {
    expect(createListSchema.safeParse({ name: "Date Night", icon: "rocket" }).success).toBe(false);
    expect(updateListSchema.safeParse({}).success).toBe(false);
  });

  it("validates item add and reorder inputs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(listItemActionSchema.safeParse({ userRestaurantId: id }).success).toBe(true);
    expect(listItemActionSchema.safeParse({ userRestaurantId: "bad" }).success).toBe(false);

    expect(
      reorderListItemSchema.safeParse({
        userRestaurantId: id,
        afterItemId: null,
        beforeItemId: id,
        position: "a0V",
      }).success,
    ).toBe(true);
  });
});
