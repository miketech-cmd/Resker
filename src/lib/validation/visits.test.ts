import { describe, expect, it } from "vitest";

import { createVisitSchema, formatVisitDate, updateVisitSchema } from "@/lib/validation/visits";

describe("visit validation schemas", () => {
  it("validates a complete visit with dishes", () => {
    const parsed = createVisitSchema.safeParse({
      visitedOn: "2026-11-14",
      ratingHalf: 9,
      notes: "Great corner table",
      dishes: [
        { name: "  Vodka Pie ", note: "crispy crust", wouldOrderAgain: true },
        { name: "Caesar Salad", note: null, wouldOrderAgain: false },
      ],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dishes[0]?.name).toBe("Vodka Pie");
      expect(parsed.data.dishes[1]?.wouldOrderAgain).toBe(false);
    }
  });

  it("rejects impossible calendar dates", () => {
    const badFormat = createVisitSchema.safeParse({ visitedOn: "11/14/2026" });
    const badDay = createVisitSchema.safeParse({ visitedOn: "2026-02-30" });

    expect(badFormat.success).toBe(false);
    expect(badDay.success).toBe(false);
  });

  it("requires at least one field on updateVisitSchema", () => {
    expect(updateVisitSchema.safeParse({}).success).toBe(false);
    expect(updateVisitSchema.safeParse({ ratingHalf: 10 }).success).toBe(true);
  });

  it("formats ISO dates cleanly in UTC", () => {
    expect(formatVisitDate("2026-11-14")).toBe("Nov 14, 2026");
  });
});
