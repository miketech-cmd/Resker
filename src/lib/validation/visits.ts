import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const visitedOnSchema = z
  .string()
  .trim()
  .refine(isValidIsoCalendarDate, "Enter a valid visit date (YYYY-MM-DD).");

export const visitDishInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dish name cannot be empty.")
    .max(120, "Dish name must be 120 characters or fewer."),
  note: z
    .string()
    .trim()
    .max(300, "Dish note must be 300 characters or fewer.")
    .nullable()
    .optional(),
  wouldOrderAgain: z.boolean().nullable().optional(),
});

export const createVisitSchema = z.object({
  visitedOn: visitedOnSchema,
  ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Visit notes must be 2000 characters or fewer.")
    .nullable()
    .optional(),
  dishes: z.array(visitDishInputSchema).max(40, "Keep up to 40 dishes per visit.").default([]),
});

export const updateVisitSchema = z
  .object({
    visitedOn: visitedOnSchema.optional(),
    ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
    notes: z
      .string()
      .trim()
      .max(2000, "Visit notes must be 2000 characters or fewer.")
      .nullable()
      .optional(),
    dishes: z.array(visitDishInputSchema).max(40, "Keep up to 40 dishes per visit.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one visit field to update.",
  });

export type VisitDishInput = z.infer<typeof visitDishInputSchema>;
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;

export function getLocalIsoDate(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatVisitDate(isoDate: string): string {
  if (!isValidIsoCalendarDate(isoDate)) return isoDate;
  const [y = 1970, m = 1, d = 1] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}
