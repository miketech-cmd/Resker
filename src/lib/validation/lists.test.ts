import { describe, expect, it } from "vitest";

import {
  createListSchema,
  listItemActionSchema,
  reorderListItemSchema,
  updateListSchema,
} from "@/lib/validation/lists";

describe("list validation schemas", () => {
  it("validates list creation with icon and trims whitespace", () => {
    const parsed = createListSchema.safeParse({
      name: "  NY 2026 Travel  ",
      description: "Late night ramen & pizza",
      icon: "noodles",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("NY 2026 Travel");
      expect(parsed.data.icon).toBe("noodles");
    }
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
