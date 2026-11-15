import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { places, userRestaurants } from "@/db/schema";
import type { CreateRestaurantInput, RestaurantStatus } from "@/lib/validation/places";
import { consumeApiQuota } from "@/server/api-usage";
import { getPlaceDetails, type NormalizedPlaceDetails } from "@/server/google";

export interface UserRestaurantSummary {
  id: string;
  placeId: string;
  googlePlaceId: string;
  googleMapsUri: string | null;
  lat: number | null;
  lng: number | null;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  cuisines: string[];
  priceLevel: number | null;
  status: RestaurantStatus;
  ratingHalf: number | null;
  notes: string | null;
  visitCount: number;
  lastVisitedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

function serializeRestaurantRow(row: {
  id: string;
  placeId: string;
  googlePlaceId: string;
  googleMapsUri: string | null;
  lat: number | null;
  lng: number | null;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  cuisines: string[];
  priceLevel: number | null;
  status: RestaurantStatus;
  ratingHalf: number | null;
  notes: string | null;
  visitCount: number;
  lastVisitedOn: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserRestaurantSummary {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findUserRestaurantByGooglePlaceId(
  userId: string,
  googlePlaceId: string,
): Promise<UserRestaurantSummary | null> {
  const [row] = await db
    .select({
      id: userRestaurants.id,
      placeId: userRestaurants.placeId,
      googlePlaceId: places.googlePlaceId,
      googleMapsUri: places.googleMapsUri,
      lat: places.lat,
      lng: places.lng,
      name: userRestaurants.name,
      address: userRestaurants.address,
      city: userRestaurants.city,
      countryCode: userRestaurants.countryCode,
      cuisines: userRestaurants.cuisines,
      priceLevel: userRestaurants.priceLevel,
      status: userRestaurants.status,
      ratingHalf: userRestaurants.ratingHalf,
      notes: userRestaurants.notes,
      visitCount: userRestaurants.visitCount,
      lastVisitedOn: userRestaurants.lastVisitedOn,
      createdAt: userRestaurants.createdAt,
      updatedAt: userRestaurants.updatedAt,
    })
    .from(userRestaurants)
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(and(eq(userRestaurants.userId, userId), eq(places.googlePlaceId, googlePlaceId)))
    .limit(1);

  return row ? serializeRestaurantRow(row) : null;
}

export async function getUserRestaurants(userId: string): Promise<UserRestaurantSummary[]> {
  const rows = await db
    .select({
      id: userRestaurants.id,
      placeId: userRestaurants.placeId,
      googlePlaceId: places.googlePlaceId,
      googleMapsUri: places.googleMapsUri,
      lat: places.lat,
      lng: places.lng,
      name: userRestaurants.name,
      address: userRestaurants.address,
      city: userRestaurants.city,
      countryCode: userRestaurants.countryCode,
      cuisines: userRestaurants.cuisines,
      priceLevel: userRestaurants.priceLevel,
      status: userRestaurants.status,
      ratingHalf: userRestaurants.ratingHalf,
      notes: userRestaurants.notes,
      visitCount: userRestaurants.visitCount,
      lastVisitedOn: userRestaurants.lastVisitedOn,
      createdAt: userRestaurants.createdAt,
      updatedAt: userRestaurants.updatedAt,
    })
    .from(userRestaurants)
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(eq(userRestaurants.userId, userId))
    .orderBy(desc(userRestaurants.updatedAt));

  return rows.map(serializeRestaurantRow);
}

/**
 * Upserts the shared `places` row (storing only Google Place ID + refreshed coords)
 * and atomically inserts the user's `user_restaurants` row.
 */
export async function createUserRestaurant(
  userId: string,
  input: CreateRestaurantInput,
): Promise<{ created: boolean; restaurant: UserRestaurantSummary }> {
  const hasCoords = input.lat != null && input.lng != null;
  const now = new Date();

  const placeUpdate: Partial<typeof places.$inferInsert> = {
    ...(hasCoords ? { lat: input.lat, lng: input.lng, locationFetchedAt: now } : {}),
    ...(input.googleMapsUri ? { googleMapsUri: input.googleMapsUri } : {}),
  };

  const [placeRow] = await db
    .insert(places)
    .values({
      googlePlaceId: input.googlePlaceId,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      locationFetchedAt: hasCoords ? now : null,
      googleMapsUri: input.googleMapsUri ?? null,
    })
    .onConflictDoUpdate({
      target: places.googlePlaceId,
      set:
        Object.keys(placeUpdate).length > 0 ? placeUpdate : { googlePlaceId: input.googlePlaceId },
    })
    .returning();

  if (!placeRow) {
    throw new Error("Failed to upsert shared place record.");
  }

  const [inserted] = await db
    .insert(userRestaurants)
    .values({
      userId,
      placeId: placeRow.id,
      name: input.name,
      address: input.address ?? null,
      city: input.city ?? null,
      countryCode: input.countryCode ?? null,
      cuisines: input.cuisines,
      priceLevel: input.priceLevel ?? null,
      status: input.status,
      ratingHalf: input.ratingHalf ?? null,
      notes: input.notes ?? null,
    })
    .onConflictDoNothing({
      target: [userRestaurants.userId, userRestaurants.placeId],
    })
    .returning();

  if (!inserted) {
    const existing = await findUserRestaurantByGooglePlaceId(userId, input.googlePlaceId);
    if (!existing) {
      throw new Error("Restaurant conflict occurred, but existing record could not be loaded.");
    }
    return { created: false, restaurant: existing };
  }

  return {
    created: true,
    restaurant: serializeRestaurantRow({
      ...inserted,
      googlePlaceId: placeRow.googlePlaceId,
      googleMapsUri: placeRow.googleMapsUri,
      lat: placeRow.lat,
      lng: placeRow.lng,
    }),
  };
}

export type ResolvePrefillResponse =
  | {
      alreadySaved: true;
      googlePlaceId: string;
      existingRestaurant: UserRestaurantSummary;
      prefill: null;
    }
  | {
      alreadySaved: false;
      googlePlaceId: string;
      existingRestaurant: null;
      prefill: NormalizedPlaceDetails;
    };

/**
 * Checks if a user already saved `googlePlaceId` before spending a metered Place Details call,
 * fetches details otherwise, and verifies against canonical IDs.
 */
export async function resolvePlacePrefillForUser(
  userId: string,
  googlePlaceId: string,
  sessionToken?: string,
): Promise<ResolvePrefillResponse> {
  const existing = await findUserRestaurantByGooglePlaceId(userId, googlePlaceId);
  if (existing) {
    return {
      alreadySaved: true,
      googlePlaceId,
      existingRestaurant: existing,
      prefill: null,
    };
  }

  await consumeApiQuota(userId, "place_details");
  const prefill = await getPlaceDetails(googlePlaceId, sessionToken);

  if (prefill.googlePlaceId !== googlePlaceId) {
    const canonicalExisting = await findUserRestaurantByGooglePlaceId(
      userId,
      prefill.googlePlaceId,
    );
    if (canonicalExisting) {
      return {
        alreadySaved: true,
        googlePlaceId: prefill.googlePlaceId,
        existingRestaurant: canonicalExisting,
        prefill: null,
      };
    }
  }

  return {
    alreadySaved: false,
    googlePlaceId: prefill.googlePlaceId,
    existingRestaurant: null,
    prefill,
  };
}
