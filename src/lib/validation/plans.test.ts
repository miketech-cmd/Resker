import { describe, expect, it } from "vitest";

import { buildPlanIcsContent, buildPlanIcsFilename, type PlanIcsSource } from "@/lib/places/ics";
import {
  completePlanSchema,
  createPlanSchema,
  formatPlanDateLabel,
  formatPlanTime,
  normalizePlanTime,
  updatePlanSchema,
} from "@/lib/validation/plans";
import { getLocalIsoDate } from "@/lib/validation/visits";

const BASE_ICS_SOURCE: PlanIcsSource = {
  id: "11111111-1111-4111-8111-111111111111",
  plannedFor: "2026-11-20",
  plannedTime: "19:30",
  note: "Table for 2, patio; vegetarian tasting menu\nBring wine",
  restaurant: {
    name: "Dirt Candy; NYC, East",
    address: "86 Allen St, New York, NY 10002",
    city: "New York",
    cuisines: ["Vegetarian", "Modern American"],
    googleMapsUri: "https://maps.google.com/?cid=999",
  },
};

describe("Phase 9 plan validation & formatting", () => {
  it("normalizes and formats 24h times into 12h labels", () => {
    expect(normalizePlanTime("19:30:00")).toBe("19:30");
    expect(normalizePlanTime("00:05")).toBe("00:05");
    expect(normalizePlanTime("invalid")).toBeNull();
    expect(normalizePlanTime(null)).toBeNull();

    expect(formatPlanTime("00:05")).toBe("12:05 AM");
    expect(formatPlanTime("12:00:00")).toBe("12:00 PM");
    expect(formatPlanTime("19:30")).toBe("7:30 PM");
    expect(formatPlanTime(null)).toBeNull();
  });

  it("formats Today, Tomorrow, and calendar dates", () => {
    expect(formatPlanDateLabel(getLocalIsoDate(0))).toBe("Today");
    expect(formatPlanDateLabel(getLocalIsoDate(1))).toBe("Tomorrow");
    expect(formatPlanDateLabel("2026-11-20")).toBe("Fri, Nov 20");
  });

  it("validates create, update, and complete plan payloads", () => {
    expect(
      createPlanSchema.safeParse({
        userRestaurantId: "11111111-1111-4111-8111-111111111111",
        plannedFor: "2026-11-20",
        plannedTime: "19:30:00",
        note: "  Patio  ",
      }),
    ).toMatchObject({
      success: true,
      data: {
        plannedFor: "2026-11-20",
        plannedTime: "19:30",
        note: "Patio",
      },
    });

    expect(
      createPlanSchema.safeParse({
        userRestaurantId: "11111111-1111-4111-8111-111111111111",
        plannedFor: "2026-02-30",
      }).success,
    ).toBe(false);

    expect(updatePlanSchema.safeParse({}).success).toBe(false);
    expect(updatePlanSchema.safeParse({ status: "cancelled" }).success).toBe(true);
    expect(completePlanSchema.safeParse({}).success).toBe(true);
  });
});

describe("Phase 9 RFC 5545 .ics calendar export", () => {
  it("builds a valid 90-minute VEVENT with escaped text and CRLF endings", () => {
    const ics = buildPlanIcsContent(BASE_ICS_SOURCE, new Date("2026-11-15T12:00:00.000Z"));
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(ics).toContain("DTSTAMP:20261115T120000Z");
    expect(ics).toContain("DTSTART:20261120T193000");
    expect(ics).toContain("DTEND:20261120T210000");
    expect(ics).toContain("SUMMARY:Dinner at Dirt Candy\\; NYC\\, East");
    expect(ics).toContain("LOCATION:86 Allen St\\, New York\\, NY 10002");
    expect(ics).toContain("Table for 2\\, patio\\; vegetarian tasting menu\\nBring wine");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("wraps DTEND across midnight cleanly when late reservations exceed 24:00", () => {
    const ics = buildPlanIcsContent(
      { ...BASE_ICS_SOURCE, plannedFor: "2026-11-30", plannedTime: "23:15" },
      new Date("2026-11-15T12:00:00.000Z"),
    );
    expect(ics).toContain("DTSTART:20261130T231500");
    expect(ics).toContain("DTEND:20261201T004500");
  });

  it("builds all-day VALUE=DATE events when plannedTime is null and slugifies filenames", () => {
    const ics = buildPlanIcsContent(
      { ...BASE_ICS_SOURCE, plannedTime: null },
      new Date("2026-11-15T12:00:00.000Z"),
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
    expect(ics).toContain("DTEND;VALUE=DATE:20261121");
    expect(buildPlanIcsFilename("Dirt Candy NYC!", "2026-11-20")).toBe(
      "dirt-candy-nyc-2026-11-20.ics",
    );
    expect(buildPlanIcsFilename("!!!", "2026-11-20")).toBe("reservation-2026-11-20.ics");
  });
});
