import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { listItems, lists, places, userRestaurants } from "@/db/schema";
import { generateKeyBetween, isValidPositionKey } from "@/lib/fractional-index";
import type {
  CreateListInput,
  ReorderListItemInput,
  UpdateListInput,
} from "@/lib/validation/lists";
import {
  RESTAURANT_SELECT_COLUMNS,
  serializeRestaurantRow,
  type UserRestaurantSummary,
} from "@/server/places";

export interface ListSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  itemCount: number;
  restaurantIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListRestaurantItem extends UserRestaurantSummary {
  position: string;
  addedAt: string;
}

export interface ListDetailData {
  list: ListSummary;
  items: ListRestaurantItem[];
}

function serializeListRow(row: typeof lists.$inferSelect, restaurantIds: string[]): ListSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    itemCount: restaurantIds.length,
    restaurantIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedListRow(userId: string, listId: string) {
  const [row] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.ownerId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Returns all lists owned by `userId` alongside ordered restaurant IDs per list
 * so both `/lists` cards and `AddToListsSheet` checkmarks load in two fast indexed queries.
 */
export async function getUserLists(userId: string): Promise<ListSummary[]> {
  const listRows = await db
    .select()
    .from(lists)
    .where(eq(lists.ownerId, userId))
    .orderBy(desc(lists.updatedAt));

  if (listRows.length === 0) {
    return [];
  }

  const listIds = listRows.map((l) => l.id);
  const membershipRows = await db
    .select({
      listId: listItems.listId,
      userRestaurantId: listItems.userRestaurantId,
    })
    .from(listItems)
    .where(inArray(listItems.listId, listIds))
    .orderBy(asc(listItems.position), asc(listItems.addedAt));

  const idsByList = new Map<string, string[]>();
  for (const row of membershipRows) {
    const bucket = idsByList.get(row.listId) ?? [];
    bucket.push(row.userRestaurantId);
    idsByList.set(row.listId, bucket);
  }

  return listRows.map((listRow) => serializeListRow(listRow, idsByList.get(listRow.id) ?? []));
}

/**
 * Returns one list owned by `userId` and its fractionally ordered restaurant items.
 */
export async function getListDetail(
  userId: string,
  listId: string,
): Promise<ListDetailData | null> {
  const listRow = await getOwnedListRow(userId, listId);
  if (!listRow) {
    return null;
  }

  const rows = await db
    .select({
      ...RESTAURANT_SELECT_COLUMNS,
      position: listItems.position,
      addedAt: listItems.addedAt,
    })
    .from(listItems)
    .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(and(eq(listItems.listId, listId), eq(userRestaurants.userId, userId)))
    .orderBy(asc(listItems.position), asc(listItems.addedAt));

  const items: ListRestaurantItem[] = rows.map((row) => ({
    ...serializeRestaurantRow(row),
    position: row.position,
    addedAt: row.addedAt.toISOString(),
  }));

  return {
    list: serializeListRow(
      listRow,
      items.map((item) => item.id),
    ),
    items,
  };
}

export async function createUserList(userId: string, input: CreateListInput): Promise<ListSummary> {
  const [inserted] = await db
    .insert(lists)
    .values({
      ownerId: userId,
      name: input.name,
      description: input.description?.trim() ? input.description.trim() : null,
      icon: input.icon ?? "bowl",
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create list.");
  }

  return serializeListRow(inserted, []);
}

export async function updateUserList(
  userId: string,
  listId: string,
  input: UpdateListInput,
): Promise<ListSummary | null> {
  const updates: Partial<typeof lists.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) {
    updates.description = input.description?.trim() ? input.description.trim() : null;
  }
  if (input.icon !== undefined) updates.icon = input.icon ?? null;

  const [updated] = await db
    .update(lists)
    .set(updates)
    .where(and(eq(lists.id, listId), eq(lists.ownerId, userId)))
    .returning();

  if (!updated) {
    return null;
  }

  const membershipRows = await db
    .select({ userRestaurantId: listItems.userRestaurantId })
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position), asc(listItems.addedAt));

  return serializeListRow(
    updated,
    membershipRows.map((r) => r.userRestaurantId),
  );
}

/**
 * Deletes only the list (`list_items` cascade automatically); user restaurants stay intact.
 */
export async function deleteUserList(
  userId: string,
  listId: string,
): Promise<{ deletedId: string } | null> {
  const [deleted] = await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.ownerId, userId)))
    .returning({ id: lists.id });

  return deleted ? { deletedId: deleted.id } : null;
}

export async function addRestaurantToList(
  userId: string,
  listId: string,
  userRestaurantId: string,
): Promise<{ added: boolean; position: string } | null> {
  const [ownedList, ownedRestaurant, tailRows] = await Promise.all([
    getOwnedListRow(userId, listId),
    db
      .select({ id: userRestaurants.id })
      .from(userRestaurants)
      .where(and(eq(userRestaurants.id, userRestaurantId), eq(userRestaurants.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        userRestaurantId: listItems.userRestaurantId,
        position: listItems.position,
      })
      .from(listItems)
      .where(eq(listItems.listId, listId))
      .orderBy(desc(listItems.position))
      .limit(1),
  ]);

  if (!ownedList || !ownedRestaurant) {
    return null;
  }

  const [existing] = await db
    .select({ position: listItems.position })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.userRestaurantId, userRestaurantId)))
    .limit(1);

  if (existing) {
    return { added: false, position: existing.position };
  }

  const lastPosition = tailRows[0]?.position ?? null;
  const nextPosition = generateKeyBetween(lastPosition, null);

  await db
    .insert(listItems)
    .values({
      listId,
      userRestaurantId,
      addedBy: userId,
      position: nextPosition,
    })
    .onConflictDoNothing();

  await db
    .update(lists)
    .set({ updatedAt: new Date() })
    .where(and(eq(lists.id, listId), eq(lists.ownerId, userId)));

  return { added: true, position: nextPosition };
}

export async function removeRestaurantFromList(
  userId: string,
  listId: string,
  userRestaurantId: string,
): Promise<{ removed: boolean } | null> {
  const ownedList = await getOwnedListRow(userId, listId);
  if (!ownedList) {
    return null;
  }

  const [deleted] = await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.userRestaurantId, userRestaurantId)))
    .returning({ userRestaurantId: listItems.userRestaurantId });

  if (deleted) {
    await db
      .update(lists)
      .set({ updatedAt: new Date() })
      .where(and(eq(lists.id, listId), eq(lists.ownerId, userId)));
  }

  return { removed: Boolean(deleted) };
}

/**
 * Reorders one restaurant item inside `listId` using a fractional midpoint key,
 * updating only that row without renumbering the entire list.
 */
export async function reorderListItem(
  userId: string,
  listId: string,
  input: ReorderListItemInput,
): Promise<{ position: string } | null> {
  const ownedList = await getOwnedListRow(userId, listId);
  if (!ownedList) {
    return null;
  }

  const currentRows = await db
    .select({
      userRestaurantId: listItems.userRestaurantId,
      position: listItems.position,
    })
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position), asc(listItems.addedAt));

  const targetRow = currentRows.find((r) => r.userRestaurantId === input.userRestaurantId);
  if (!targetRow) {
    return null;
  }

  const afterPos = input.afterItemId
    ? (currentRows.find((r) => r.userRestaurantId === input.afterItemId)?.position ?? null)
    : null;
  const beforePos = input.beforeItemId
    ? (currentRows.find((r) => r.userRestaurantId === input.beforeItemId)?.position ?? null)
    : null;

  let nextPosition: string;
  if (
    input.position &&
    isValidPositionKey(input.position) &&
    (afterPos === null || input.position > afterPos) &&
    (beforePos === null || input.position < beforePos)
  ) {
    nextPosition = input.position;
  } else {
    nextPosition = generateKeyBetween(afterPos, beforePos);
  }

  await db
    .update(listItems)
    .set({ position: nextPosition })
    .where(
      and(eq(listItems.listId, listId), eq(listItems.userRestaurantId, input.userRestaurantId)),
    );

  await db
    .update(lists)
    .set({ updatedAt: new Date() })
    .where(and(eq(lists.id, listId), eq(lists.ownerId, userId)));

  return { position: nextPosition };
}
