import { z } from "zod";

export const RESTAURANT_STATUSES = ["to_try", "exploration", "tried"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const STATUS_LABELS: Record<RestaurantStatus, string> = {
  to_try: "To Try",
  exploration: "Exploration",
  tried: "Tried",
};

export const resolveUrlSchema = z.object({
  url: z.string().trim().min(1, "Paste a Google Maps link first.").max(2048, "Link is too long."),
});

export const autocompleteQuerySchema = z.object({
  q: z.string().trim().min(3, "Type at least 3 characters.").max(120),
  session: z.string().trim().min(8).max(128).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const placeDetailsRequestSchema = z.object({
  googlePlaceId: z.string().trim().min(10, "Invalid place identifier.").max(256),
  sessionToken: z.string().trim().min(8).max(128).optional(),
});

export const createRestaurantSchema = z.object({
  googlePlaceId: z.string().trim().min(10).max(256),
  googleMapsUri: z.string().url().max(2048).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Restaurant name is required.")
    .max(160, "Name must be 160 characters or fewer."),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  countryCode: z.string().trim().max(8).nullable().optional(),
  cuisines: z
    .array(z.string().trim().min(1).max(40))
    .max(6, "Keep up to 6 cuisine tags.")
    .default([]),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  status: z.enum(RESTAURANT_STATUSES).default("to_try"),
  ratingHalf: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
