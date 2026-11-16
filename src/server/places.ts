import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { places, userRestaurants } from "@/db/schema";
import type {
  CreateRestaurantInput,
  RestaurantStatus,
  UpdateRestaurantInput,
} from "@/lib/validation/places";
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

export function serializeRestaurantRow(row: {
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

export const RESTAURANT_SELECT_COLUMNS = {
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
} as const;

export async function findUserRestaurantByGooglePlaceId(
  userId: string,
  googlePlaceId: string,
): Promise<UserRestaurantSummary | null> {
  const [row] = await db
    .select(RESTAURANT_SELECT_COLUMNS)
    .from(userRestaurants)
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(and(eq(userRestaurants.userId, userId), eq(places.googlePlaceId, googlePlaceId)))
    .limit(1);

  return row ? serializeRestaurantRow(row) : null;
}

export async function getUserRestaurants(userId: string): Promise<UserRestaurantSummary[]> {
  const rows = await db
    .select(RESTAURANT_SELECT_COLUMNS)
    .from(userRestaurants)
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(eq(userRestaurants.userId, userId))
    .orderBy(desc(userRestaurants.updatedAt));

  return rows.map(serializeRestaurantRow);
}

export async function getUserRestaurantById(
  userId: string,
  restaurantId: string,
): Promise<UserRestaurantSummary | null> {
  const [row] = await db
    .select(RESTAURANT_SELECT_COLUMNS)
    .from(userRestaurants)
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(and(eq(userRestaurants.id, restaurantId), eq(userRestaurants.userId, userId)))
    .limit(1);

  return row ? serializeRestaurantRow(row) : null;
}

export async function updateUserRestaurant(
  userId: string,
  restaurantId: string,
  input: UpdateRestaurantInput,
): Promise<UserRestaurantSummary | null> {
  const updates: Partial<typeof userRestaurants.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.address !== undefined) updates.address = input.address || null;
  if (input.city !== undefined) updates.city = input.city || null;
  if (input.countryCode !== undefined) {
    updates.countryCode = input.countryCode ? input.countryCode.toUpperCase() : null;
  }
  if (input.cuisines !== undefined) updates.cuisines = input.cuisines;
  if (input.priceLevel !== undefined) updates.priceLevel = input.priceLevel ?? null;
  if (input.status !== undefined) updates.status = input.status;
  if (input.ratingHalf !== undefined) updates.ratingHalf = input.ratingHalf ?? null;
  if (input.notes !== undefined) updates.notes = input.notes || null;
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(userRestaurants)
    .set(updates)
    .where(and(eq(userRestaurants.id, restaurantId), eq(userRestaurants.userId, userId)))
    .returning({ id: userRestaurants.id });

  if (!updated) return null;
  return getUserRestaurantById(userId, updated.id);
}

export async function deleteUserRestaurant(
  userId: string,
  restaurantId: string,
): Promise<{ deletedId: string } | null> {
  const [deleted] = await db
    .delete(userRestaurants)
    .where(and(eq(userRestaurants.id, restaurantId), eq(userRestaurants.userId, userId)))
    .returning({ id: userRestaurants.id });

  return deleted ? { deletedId: deleted.id } : null;
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
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      countryCode: input.countryCode?.trim().toUpperCase() || null,
      cuisines: input.cuisines,
      priceLevel: input.priceLevel ?? null,
      status: input.status,
      ratingHalf: input.ratingHalf ?? null,
      notes: input.notes?.trim() || null,
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

export interface CopiedRestaurantSource {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  cuisines: string[];
  priceLevel: number | null;
}

/**
 * Copies a spot's public place metadata into `viewerUserId`'s saved Places library
 * (`status: "to_try"`, idempotent on `(userId, placeId)` with zero Google API calls).
 */
export async function saveCopiedRestaurantSpot(
  viewerUserId: string,
  source: CopiedRestaurantSource,
): Promise<{ created: boolean; restaurant: UserRestaurantSummary } | null> {
  const inserted = await db
    .insert(userRestaurants)
    .values({
      userId: viewerUserId,
      placeId: source.placeId,
      name: source.name,
      address: source.address,
      city: source.city,
      countryCode: source.countryCode,
      cuisines: source.cuisines,
      priceLevel: source.priceLevel,
      status: "to_try",
    })
    .onConflictDoNothing({
      target: [userRestaurants.userId, userRestaurants.placeId],
    })
    .returning({ id: userRestaurants.id });

  const [savedRow] = await db
    .select(RESTAURANT_SELECT_COLUMNS)
    .from(userRestaurants)
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(
      and(eq(userRestaurants.userId, viewerUserId), eq(userRestaurants.placeId, source.placeId)),
    )
    .limit(1);

  if (!savedRow) return null;

  return {
    created: inserted.length > 0,
    restaurant: serializeRestaurantRow(savedRow),
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
