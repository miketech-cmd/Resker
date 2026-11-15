import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db, dbPool } from "@/db";
import { userRestaurants, visitDishes, visits } from "@/db/schema";
import type { CreateVisitInput, UpdateVisitInput } from "@/lib/validation/visits";
import { getUserRestaurantById, type UserRestaurantSummary } from "@/server/places";

export interface VisitDishSummary {
  id: string;
  visitId: string;
  name: string;
  note: string | null;
  wouldOrderAgain: boolean | null;
  position: number;
}

export interface VisitSummary {
  id: string;
  userRestaurantId: string;
  visitedOn: string;
  ratingHalf: number | null;
  notes: string | null;
  dishes: VisitDishSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface VisitWriteResult {
  visit: VisitSummary;
  restaurant: UserRestaurantSummary;
}

export interface VisitDeleteResult {
  deletedId: string;
  restaurantId: string;
  restaurant: UserRestaurantSummary;
}

function serializeVisitRow(
  row: typeof visits.$inferSelect,
  dishes: VisitDishSummary[],
): VisitSummary {
  return {
    id: row.id,
    userRestaurantId: row.userRestaurantId,
    visitedOn: row.visitedOn,
    ratingHalf: row.ratingHalf,
    notes: row.notes,
    dishes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDishRow(row: typeof visitDishes.$inferSelect): VisitDishSummary {
  return {
    id: row.id,
    visitId: row.visitId,
    name: row.name,
    note: row.note,
    wouldOrderAgain: row.wouldOrderAgain,
    position: row.position,
  };
}

type PoolTxExecutor = Parameters<Parameters<typeof dbPool.transaction>[0]>[0];

async function recomputeRestaurantVisitStatsTx(
  tx: PoolTxExecutor,
  userId: string,
  restaurantId: string,
  options: {
    upgradeFirstVisitStatus?: "to_try" | "exploration" | "tried";
    priorVisitCount?: number;
  },
) {
  const [stats] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      lastVisitedOn: sql<string | null>`max(${visits.visitedOn})`,
    })
    .from(visits)
    .where(and(eq(visits.userRestaurantId, restaurantId), eq(visits.userId, userId)));

  const nextVisitCount = stats?.count ?? 0;
  const nextLastVisitedOn = stats?.lastVisitedOn ?? null;

  const updates: Partial<typeof userRestaurants.$inferInsert> = {
    visitCount: nextVisitCount,
    lastVisitedOn: nextLastVisitedOn,
    updatedAt: new Date(),
  };

  if (
    options.priorVisitCount === 0 &&
    (options.upgradeFirstVisitStatus === "to_try" ||
      options.upgradeFirstVisitStatus === "exploration")
  ) {
    updates.status = "tried";
  }

  await tx
    .update(userRestaurants)
    .set(updates)
    .where(and(eq(userRestaurants.id, restaurantId), eq(userRestaurants.userId, userId)));
}

/**
 * Fetches all visits + ordered dishes for one saved restaurant owned by `userId`.
 * Returns null if the restaurant does not exist or belongs to another user.
 */
export async function getRestaurantVisits(
  userId: string,
  restaurantId: string,
): Promise<VisitSummary[] | null> {
  const [ownedRestaurant] = await db
    .select({ id: userRestaurants.id })
    .from(userRestaurants)
    .where(and(eq(userRestaurants.id, restaurantId), eq(userRestaurants.userId, userId)))
    .limit(1);

  if (!ownedRestaurant) {
    return null;
  }

  const visitRows = await db
    .select()
    .from(visits)
    .where(and(eq(visits.userRestaurantId, restaurantId), eq(visits.userId, userId)))
    .orderBy(desc(visits.visitedOn), desc(visits.createdAt));

  if (visitRows.length === 0) {
    return [];
  }

  const visitIds = visitRows.map((v) => v.id);
  const dishRows = await db
    .select()
    .from(visitDishes)
    .where(inArray(visitDishes.visitId, visitIds))
    .orderBy(asc(visitDishes.position));

  const dishesByVisit = new Map<string, VisitDishSummary[]>();
  for (const dish of dishRows) {
    const bucket = dishesByVisit.get(dish.visitId) ?? [];
    bucket.push(serializeDishRow(dish));
    dishesByVisit.set(dish.visitId, bucket);
  }

  return visitRows.map((row) => serializeVisitRow(row, dishesByVisit.get(row.id) ?? []));
}

/**
 * Atomically logs a visit + ordered dishes, updates visit stats, and auto-promotes
 * first visits from `to_try` or `exploration` to `tried`.
 */
export async function createVisit(
  userId: string,
  restaurantId: string,
  input: CreateVisitInput,
): Promise<VisitWriteResult | null> {
  const createdVisit = await dbPool.transaction(async (tx) => {
    const [ownedRestaurant] = await tx
      .select({
        id: userRestaurants.id,
        status: userRestaurants.status,
        visitCount: userRestaurants.visitCount,
      })
      .from(userRestaurants)
      .where(and(eq(userRestaurants.id, restaurantId), eq(userRestaurants.userId, userId)))
      .limit(1);

    if (!ownedRestaurant) {
      return null;
    }

    const [insertedVisit] = await tx
      .insert(visits)
      .values({
        userRestaurantId: restaurantId,
        userId,
        visitedOn: input.visitedOn,
        ratingHalf: input.ratingHalf ?? null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
      })
      .returning();

    if (!insertedVisit) {
      throw new Error("Failed to insert visit.");
    }

    let insertedDishes: (typeof visitDishes.$inferSelect)[] = [];
    if (input.dishes.length > 0) {
      insertedDishes = await tx
        .insert(visitDishes)
        .values(
          input.dishes.map((dish, index) => ({
            visitId: insertedVisit.id,
            name: dish.name.trim(),
            note: dish.note?.trim() ? dish.note.trim() : null,
            wouldOrderAgain: dish.wouldOrderAgain ?? null,
            position: index,
          })),
        )
        .returning();
    }

    await recomputeRestaurantVisitStatsTx(tx, userId, restaurantId, {
      upgradeFirstVisitStatus: ownedRestaurant.status,
      priorVisitCount: ownedRestaurant.visitCount,
    });

    return serializeVisitRow(insertedVisit, insertedDishes.map(serializeDishRow));
  });

  if (!createdVisit) {
    return null;
  }

  const restaurant = await getUserRestaurantById(userId, restaurantId);
  if (!restaurant) {
    return null;
  }

  return { visit: createdVisit, restaurant };
}

/**
 * Updates an existing visit (and optionally replaces its ordered dishes) inside a transaction,
 * then recalculates the parent restaurant's visitCount and lastVisitedOn.
 */
export async function updateVisit(
  userId: string,
  visitId: string,
  input: UpdateVisitInput,
): Promise<VisitWriteResult | null> {
  const updatedVisit = await dbPool.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(visits)
      .where(and(eq(visits.id, visitId), eq(visits.userId, userId)))
      .limit(1);

    if (!existing) {
      return null;
    }

    const visitUpdates: Partial<typeof visits.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.visitedOn !== undefined) visitUpdates.visitedOn = input.visitedOn;
    if (input.ratingHalf !== undefined) visitUpdates.ratingHalf = input.ratingHalf ?? null;
    if (input.notes !== undefined) {
      visitUpdates.notes = input.notes?.trim() ? input.notes.trim() : null;
    }

    const [savedVisit] = await tx
      .update(visits)
      .set(visitUpdates)
      .where(and(eq(visits.id, visitId), eq(visits.userId, userId)))
      .returning();

    if (!savedVisit) {
      return null;
    }

    let nextDishes: VisitDishSummary[];
    if (input.dishes !== undefined) {
      await tx.delete(visitDishes).where(eq(visitDishes.visitId, visitId));
      if (input.dishes.length > 0) {
        const inserted = await tx
          .insert(visitDishes)
          .values(
            input.dishes.map((dish, index) => ({
              visitId,
              name: dish.name.trim(),
              note: dish.note?.trim() ? dish.note.trim() : null,
              wouldOrderAgain: dish.wouldOrderAgain ?? null,
              position: index,
            })),
          )
          .returning();
        nextDishes = inserted.map(serializeDishRow);
      } else {
        nextDishes = [];
      }
    } else {
      const existingDishes = await tx
        .select()
        .from(visitDishes)
        .where(eq(visitDishes.visitId, visitId))
        .orderBy(asc(visitDishes.position));
      nextDishes = existingDishes.map(serializeDishRow);
    }

    await recomputeRestaurantVisitStatsTx(tx, userId, existing.userRestaurantId, {});
    return serializeVisitRow(savedVisit, nextDishes);
  });

  if (!updatedVisit) {
    return null;
  }

  const restaurant = await getUserRestaurantById(userId, updatedVisit.userRestaurantId);
  if (!restaurant) {
    return null;
  }

  return { visit: updatedVisit, restaurant };
}

/**
 * Deletes a visit and cascades its ordered dishes, recalculating parent restaurant stats.
 */
export async function deleteVisit(
  userId: string,
  visitId: string,
): Promise<VisitDeleteResult | null> {
  const deleted = await dbPool.transaction(async (tx) => {
    const [removed] = await tx
      .delete(visits)
      .where(and(eq(visits.id, visitId), eq(visits.userId, userId)))
      .returning({
        id: visits.id,
        userRestaurantId: visits.userRestaurantId,
      });

    if (!removed) {
      return null;
    }

    await recomputeRestaurantVisitStatsTx(tx, userId, removed.userRestaurantId, {});
    return removed;
  });

  if (!deleted) {
    return null;
  }

  const restaurant = await getUserRestaurantById(userId, deleted.userRestaurantId);
  if (!restaurant) {
    return null;
  }

  return {
    deletedId: deleted.id,
    restaurantId: deleted.userRestaurantId,
    restaurant,
  };
}
