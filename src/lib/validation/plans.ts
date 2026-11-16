import { z } from "zod";

import {
  getLocalIsoDate,
  isValidIsoCalendarDate,
  visitDishInputSchema,
  visitedOnSchema,
} from "@/lib/validation/visits";

export const PLAN_STATUSES = ["planned", "done", "cancelled"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

const TIME_24H_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export const plannedForSchema = z
  .string()
  .trim()
  .refine(isValidIsoCalendarDate, "Enter a valid reservation date (YYYY-MM-DD).");

export const plannedTimeSchema = z
  .string()
  .trim()
  .regex(TIME_24H_RE, "Enter a valid time (HH:MM).")
  .transform((val) => val.slice(0, 5));

export const createPlanSchema = z.object({
  userRestaurantId: z.string().uuid("Invalid restaurant identifier."),
  plannedFor: plannedForSchema,
  plannedTime: plannedTimeSchema.nullable().optional(),
  note: z
    .string()
    .trim()
    .max(500, "Reservation note must be 500 characters or fewer.")
    .nullable()
    .optional(),
});

export const updatePlanSchema = z
  .object({
    plannedFor: plannedForSchema.optional(),
    plannedTime: plannedTimeSchema.nullable().optional(),
    note: z
      .string()
      .trim()
      .max(500, "Reservation note must be 500 characters or fewer.")
      .nullable()
      .optional(),
    status: z.enum(PLAN_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const completePlanSchema = z.object({
  visitedOn: visitedOnSchema.optional(),
  ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Visit notes must be 2000 characters or fewer.")
    .nullable()
    .optional(),
  dishes: z.array(visitDishInputSchema).max(40, "Keep up to 40 dishes per visit.").default([]),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CompletePlanInput = z.infer<typeof completePlanSchema>;

export function normalizePlanTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = TIME_24H_RE.exec(raw.trim());
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export function formatPlanTime(raw: string | null | undefined): string | null {
  const normalized = normalizePlanTime(raw);
  if (!normalized) return null;
  const [hourStr = "0", minStr = "00"] = normalized.split(":");
  const hour24 = Number(hourStr);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minStr} ${period}`;
}

export function formatPlanDateLabel(isoDate: string): string {
  if (!isValidIsoCalendarDate(isoDate)) return isoDate;
  const today = getLocalIsoDate(0);
  const tomorrow = getLocalIsoDate(1);
  if (isoDate === today) return "Today";
  if (isoDate === tomorrow) return "Tomorrow";

  const [y = 1970, m = 1, d = 1] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}
