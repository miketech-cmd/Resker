import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db, dbPool } from "@/db";
import { places, plannedVisits, userRestaurants, visits } from "@/db/schema";
import {
  normalizePlanTime,
  type CompletePlanInput,
  type CreatePlanInput,
  type PlanStatus,
  type UpdatePlanInput,
} from "@/lib/validation/plans";
import { getUserRestaurantById, type UserRestaurantSummary } from "@/server/places";
import { insertVisitInTx, type VisitSummary } from "@/server/visits";

export interface PlannedVisitRestaurantRef {
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
  status: "to_try" | "exploration" | "tried";
}

export interface PlannedVisitSummary {
  id: string;
  userRestaurantId: string;
  plannedFor: string;
  plannedTime: string | null;
  note: string | null;
  status: PlanStatus;
  visitId: string | null;
  createdAt: string;
  restaurant: PlannedVisitRestaurantRef;
}

export interface CompletePlanResult {
  alreadyCompleted: boolean;
  plan: PlannedVisitSummary;
  visit: VisitSummary | null;
  restaurant: UserRestaurantSummary;
}

function serializePlanRow(
  row: typeof plannedVisits.$inferSelect,
  rest: typeof userRestaurants.$inferSelect,
  place: typeof places.$inferSelect,
): PlannedVisitSummary {
  return {
    id: row.id,
    userRestaurantId: row.userRestaurantId,
    plannedFor: row.plannedFor,
    plannedTime: normalizePlanTime(row.plannedTime),
    note: row.note,
    status: row.status,
    visitId: row.visitId,
    createdAt: row.createdAt.toISOString(),
    restaurant: {
      id: rest.id,
      placeId: rest.placeId,
      googlePlaceId: place.googlePlaceId,
      googleMapsUri: place.googleMapsUri,
      lat: place.lat,
      lng: place.lng,
      name: rest.name,
      address: rest.address,
      city: rest.city,
      countryCode: rest.countryCode,
      cuisines: rest.cuisines ?? [],
      priceLevel: rest.priceLevel,
      status: rest.status,
    },
  };
}

export async function getUserPlans(userId: string): Promise<PlannedVisitSummary[]> {
  const rows = await db
    .select({
      plan: plannedVisits,
      restaurant: userRestaurants,
      place: places,
    })
    .from(plannedVisits)
    .innerJoin(userRestaurants, eq(plannedVisits.userRestaurantId, userRestaurants.id))
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(eq(plannedVisits.userId, userId))
    .orderBy(
      sql`CASE WHEN ${plannedVisits.status} = 'planned' THEN 0 ELSE 1 END`,
      asc(plannedVisits.plannedFor),
      asc(plannedVisits.plannedTime),
      desc(plannedVisits.createdAt),
    );

  return rows.map((r) => serializePlanRow(r.plan, r.restaurant, r.place));
}

async function getUserPlanById(
  userId: string,
  planId: string,
): Promise<PlannedVisitSummary | null> {
  const [row] = await db
    .select({
      plan: plannedVisits,
      restaurant: userRestaurants,
      place: places,
    })
    .from(plannedVisits)
    .innerJoin(userRestaurants, eq(plannedVisits.userRestaurantId, userRestaurants.id))
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(and(eq(plannedVisits.id, planId), eq(plannedVisits.userId, userId)))
    .limit(1);

  return row ? serializePlanRow(row.plan, row.restaurant, row.place) : null;
}

export async function createPlannedVisit(
  userId: string,
  input: CreatePlanInput,
): Promise<PlannedVisitSummary | null> {
  const [ownedRestaurant] = await db
    .select({ id: userRestaurants.id })
    .from(userRestaurants)
    .where(and(eq(userRestaurants.id, input.userRestaurantId), eq(userRestaurants.userId, userId)))
    .limit(1);

  if (!ownedRestaurant) {
    return null;
  }

  const [inserted] = await db
    .insert(plannedVisits)
    .values({
      userRestaurantId: input.userRestaurantId,
      userId,
      plannedFor: input.plannedFor,
      plannedTime: input.plannedTime ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
      status: "planned",
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create planned visit.");
  }

  return getUserPlanById(userId, inserted.id);
}

export async function updatePlannedVisit(
  userId: string,
  planId: string,
  input: UpdatePlanInput,
): Promise<PlannedVisitSummary | null> {
  const updates: Partial<typeof plannedVisits.$inferInsert> = {};
  if (input.plannedFor !== undefined) updates.plannedFor = input.plannedFor;
  if (input.plannedTime !== undefined) updates.plannedTime = input.plannedTime ?? null;
  if (input.note !== undefined) updates.note = input.note?.trim() ? input.note.trim() : null;
  if (input.status !== undefined) updates.status = input.status;

  const [updated] = await db
    .update(plannedVisits)
    .set(updates)
    .where(and(eq(plannedVisits.id, planId), eq(plannedVisits.userId, userId)))
    .returning();

  if (!updated) {
    return null;
  }

  return getUserPlanById(userId, updated.id);
}

export async function deletePlannedVisit(
  userId: string,
  planId: string,
): Promise<{ deletedId: string } | null> {
  const [deleted] = await db
    .delete(plannedVisits)
    .where(and(eq(plannedVisits.id, planId), eq(plannedVisits.userId, userId)))
    .returning({ id: plannedVisits.id });

  return deleted ? { deletedId: deleted.id } : null;
}

/**
 * Atomically converts a planned visit ("Log it") into a real visit + dishes,
 * auto-promotes `to_try` / `exploration` to `tried`, and links `planned_visits.visit_id`.
 */
export async function completePlannedVisit(
  userId: string,
  planId: string,
  input: CompletePlanInput,
): Promise<CompletePlanResult | null> {
  const txResult = await dbPool.transaction(async (tx) => {
    const [planRow] = await tx
      .select()
      .from(plannedVisits)
      .where(and(eq(plannedVisits.id, planId), eq(plannedVisits.userId, userId)))
      .limit(1);

    if (!planRow) {
      return null;
    }

    if (planRow.status === "done" && planRow.visitId) {
      return {
        alreadyCompleted: true,
        restaurantId: planRow.userRestaurantId,
        visit: null as VisitSummary | null,
      };
    }

    const createdVisit = await insertVisitInTx(tx, userId, planRow.userRestaurantId, {
      visitedOn: input.visitedOn ?? planRow.plannedFor,
      ratingHalf: input.ratingHalf ?? null,
      notes: input.notes !== undefined ? input.notes : planRow.note,
      dishes: input.dishes ?? [],
    });

    if (!createdVisit) {
      return null;
    }

    await tx
      .update(plannedVisits)
      .set({
        status: "done",
        visitId: createdVisit.id,
      })
      .where(and(eq(plannedVisits.id, planId), eq(plannedVisits.userId, userId)));

    return {
      alreadyCompleted: false,
      restaurantId: planRow.userRestaurantId,
      visit: createdVisit,
    };
  });

  if (!txResult) {
    return null;
  }

  const [plan, restaurant] = await Promise.all([
    getUserPlanById(userId, planId),
    getUserRestaurantById(userId, txResult.restaurantId),
  ]);

  if (!plan || !restaurant) {
    return null;
  }

  return {
    alreadyCompleted: txResult.alreadyCompleted,
    plan,
    visit: txResult.visit,
    restaurant,
  };
}

/**
 * Fetches lightweight user activity stats for `/me`.
 */
export async function getUserProfileStats(userId: string): Promise<{
  placesTried: number;
  visitsThisYear: number;
  upcomingPlans: number;
}> {
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;

  const [[triedRow], [visitRow], [planRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRestaurants)
      .where(and(eq(userRestaurants.userId, userId), eq(userRestaurants.status, "tried"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visits)
      .where(and(eq(visits.userId, userId), sql`${visits.visitedOn} >= ${yearStart}`)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(plannedVisits)
      .where(and(eq(plannedVisits.userId, userId), eq(plannedVisits.status, "planned"))),
  ]);

  return {
    placesTried: triedRow?.count ?? 0,
    visitsThisYear: visitRow?.count ?? 0,
    upcomingPlans: planRow?.count ?? 0,
  };
}
