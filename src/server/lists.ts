import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db, dbPool } from "@/db";
import { listItems, lists, places, user, userRestaurants } from "@/db/schema";
import {
  generateKeyBetween,
  generateNKeysBetween,
  isValidPositionKey,
} from "@/lib/fractional-index";
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
  publicSlug: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  city: string | null;
  copyCount: number;
  sourceListId: string | null;
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

export interface PublicListSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  publicSlug: string;
  isFeatured: boolean;
  city: string | null;
  copyCount: number;
  itemCount: number;
  curatorName: string;
  curatorUsername: string | null;
  cuisines: string[];
  savedCopyListId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicListRestaurantItem {
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
  curatorNote: string | null;
  position: string;
  addedAt: string;
  savedByViewer: boolean;
  viewerRestaurantId: string | null;
}

export interface PublicListDetailData {
  list: PublicListSummary;
  items: PublicListRestaurantItem[];
}

export function generatePublicSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : `list-${suffix}`;
}

function serializeListRow(row: typeof lists.$inferSelect, restaurantIds: string[]): ListSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    publicSlug: row.publicSlug,
    isPublic: row.isPublic,
    isFeatured: row.isFeatured,
    city: row.city,
    copyCount: row.copyCount,
    sourceListId: row.sourceListId,
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
  const isPublic = Boolean(input.isPublic);
  const [inserted] = await db
    .insert(lists)
    .values({
      ownerId: userId,
      name: input.name,
      description: input.description?.trim() ? input.description.trim() : null,
      icon: input.icon ?? "bowl",
      isPublic,
      publicSlug: isPublic ? generatePublicSlug(input.name) : null,
      city: input.city?.trim() ? input.city.trim() : null,
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
  const existing = await getOwnedListRow(userId, listId);
  if (!existing) {
    return null;
  }

  const updates: Partial<typeof lists.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) {
    updates.description = input.description?.trim() ? input.description.trim() : null;
  }
  if (input.icon !== undefined) updates.icon = input.icon ?? null;
  if (input.city !== undefined) {
    updates.city = input.city?.trim() ? input.city.trim() : null;
  }
  if (input.isPublic !== undefined) {
    updates.isPublic = input.isPublic;
    if (input.isPublic && !existing.publicSlug) {
      updates.publicSlug = generatePublicSlug(input.name ?? existing.name);
    }
  }

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

function collectTopCuisines(cuisinesLists: string[][]): string[] {
  const counts = new Map<string, number>();
  for (const rowCuisines of cuisinesLists) {
    for (const tag of rowCuisines) {
      const cleaned = tag.trim();
      if (!cleaned) continue;
      const lower = cleaned.toLowerCase();
      if (lower === "restaurant" || lower === "vegetarian-friendly") continue;
      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name]) => name);
}

/**
 * Returns discoverable public lists (`isPublic = true`), ordered featured-first then by copies,
 * never exposing private ratings, visit history, notes, or curator email addresses.
 */
export async function getPublicLists(
  viewerUserId: string | null,
  filters?: { q?: string; city?: string },
): Promise<PublicListSummary[]> {
  const conditions = [eq(lists.isPublic, true)];
  const cityFilter = filters?.city?.trim();
  const queryFilter = filters?.q?.trim();

  if (cityFilter) {
    const cityCondition = or(ilike(lists.city, cityFilter), ilike(lists.name, `%${cityFilter}%`));
    if (cityCondition) conditions.push(cityCondition);
  }

  if (queryFilter) {
    const searchCondition = or(
      ilike(lists.name, `%${queryFilter}%`),
      ilike(lists.description, `%${queryFilter}%`),
      ilike(lists.city, `%${queryFilter}%`),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      list: lists,
      curatorName: user.name,
      curatorUsername: user.displayUsername,
      curatorRawUsername: user.username,
    })
    .from(lists)
    .innerJoin(user, eq(lists.ownerId, user.id))
    .where(and(...conditions))
    .orderBy(desc(lists.isFeatured), desc(lists.copyCount), desc(lists.updatedAt));

  if (rows.length === 0) {
    return [];
  }

  const listIds = rows.map((r) => r.list.id);

  const [itemMetaRows, viewerCopies] = await Promise.all([
    db
      .select({
        listId: listItems.listId,
        cuisines: userRestaurants.cuisines,
      })
      .from(listItems)
      .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
      .where(inArray(listItems.listId, listIds)),
    viewerUserId
      ? db
          .select({ id: lists.id, sourceListId: lists.sourceListId })
          .from(lists)
          .where(and(eq(lists.ownerId, viewerUserId), inArray(lists.sourceListId, listIds)))
      : Promise.resolve([]),
  ]);

  const cuisinesByList = new Map<string, string[][]>();
  const countByList = new Map<string, number>();
  for (const row of itemMetaRows) {
    countByList.set(row.listId, (countByList.get(row.listId) ?? 0) + 1);
    const bucket = cuisinesByList.get(row.listId) ?? [];
    bucket.push(row.cuisines);
    cuisinesByList.set(row.listId, bucket);
  }

  const savedCopyBySource = new Map<string, string>();
  for (const copy of viewerCopies) {
    if (copy.sourceListId && !savedCopyBySource.has(copy.sourceListId)) {
      savedCopyBySource.set(copy.sourceListId, copy.id);
    }
  }

  const summaries: PublicListSummary[] = [];
  for (const entry of rows) {
    if (!entry.list.publicSlug) continue;
    summaries.push({
      id: entry.list.id,
      name: entry.list.name,
      description: entry.list.description,
      icon: entry.list.icon,
      publicSlug: entry.list.publicSlug,
      isFeatured: entry.list.isFeatured,
      city: entry.list.city,
      copyCount: entry.list.copyCount,
      itemCount: countByList.get(entry.list.id) ?? 0,
      curatorName: entry.curatorName,
      curatorUsername: entry.curatorUsername ?? entry.curatorRawUsername ?? null,
      cuisines: collectTopCuisines(cuisinesByList.get(entry.list.id) ?? []),
      savedCopyListId: savedCopyBySource.get(entry.list.id) ?? null,
      createdAt: entry.list.createdAt.toISOString(),
      updatedAt: entry.list.updatedAt.toISOString(),
    });
  }

  return summaries;
}

/**
 * Loads one public list by slug (`isPublic = true` or owned by `viewerUserId`),
 * returning strictly sanitized catalog fields plus viewer saved status.
 */
export async function getPublicListBySlug(
  slug: string,
  viewerUserId: string | null,
): Promise<PublicListDetailData | null> {
  const [header] = await db
    .select({
      list: lists,
      curatorName: user.name,
      curatorUsername: user.displayUsername,
      curatorRawUsername: user.username,
    })
    .from(lists)
    .innerJoin(user, eq(lists.ownerId, user.id))
    .where(eq(lists.publicSlug, slug))
    .limit(1);

  if (!header || !header.list.publicSlug) {
    return null;
  }

  if (!header.list.isPublic && header.list.ownerId !== viewerUserId) {
    return null;
  }

  const itemRows = await db
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
      curatorNote: listItems.curatorNote,
      position: listItems.position,
      addedAt: listItems.addedAt,
    })
    .from(listItems)
    .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
    .innerJoin(places, eq(userRestaurants.placeId, places.id))
    .where(eq(listItems.listId, header.list.id))
    .orderBy(asc(listItems.position), asc(listItems.addedAt));

  const placeIds = itemRows.map((item) => item.placeId);

  const [viewerRestaurants, viewerCopies] = await Promise.all([
    viewerUserId && placeIds.length > 0
      ? db
          .select({ id: userRestaurants.id, placeId: userRestaurants.placeId })
          .from(userRestaurants)
          .where(
            and(
              eq(userRestaurants.userId, viewerUserId),
              inArray(userRestaurants.placeId, placeIds),
            ),
          )
      : Promise.resolve([]),
    viewerUserId
      ? db
          .select({ id: lists.id })
          .from(lists)
          .where(and(eq(lists.ownerId, viewerUserId), eq(lists.sourceListId, header.list.id)))
          .orderBy(desc(lists.createdAt))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const viewerIdByPlace = new Map<string, string>();
  for (const row of viewerRestaurants) {
    viewerIdByPlace.set(row.placeId, row.id);
  }

  const items: PublicListRestaurantItem[] = itemRows.map((row) => {
    const viewerRestaurantId = viewerIdByPlace.get(row.placeId) ?? null;
    return {
      id: row.id,
      placeId: row.placeId,
      googlePlaceId: row.googlePlaceId,
      googleMapsUri: row.googleMapsUri,
      lat: row.lat,
      lng: row.lng,
      name: row.name,
      address: row.address,
      city: row.city,
      countryCode: row.countryCode,
      cuisines: row.cuisines,
      priceLevel: row.priceLevel,
      curatorNote: row.curatorNote,
      position: row.position,
      addedAt: row.addedAt.toISOString(),
      savedByViewer: Boolean(viewerRestaurantId),
      viewerRestaurantId,
    };
  });

  return {
    list: {
      id: header.list.id,
      name: header.list.name,
      description: header.list.description,
      icon: header.list.icon,
      publicSlug: header.list.publicSlug,
      isFeatured: header.list.isFeatured,
      city: header.list.city,
      copyCount: header.list.copyCount,
      itemCount: items.length,
      curatorName: header.curatorName,
      curatorUsername: header.curatorUsername ?? header.curatorRawUsername ?? null,
      cuisines: collectTopCuisines(items.map((item) => item.cuisines)),
      savedCopyListId: viewerCopies[0]?.id ?? null,
      createdAt: header.list.createdAt.toISOString(),
      updatedAt: header.list.updatedAt.toISOString(),
    },
    items,
  };
}

/**
 * Clones one spot from a public list into `viewerUserId`'s `user_restaurants` (status `to_try`),
 * deduplicating cleanly on `(userId, placeId)` with zero external Google Places API calls.
 */
export async function saveSpotFromPublicList(
  viewerUserId: string,
  slug: string,
  sourceRestaurantId: string,
): Promise<{ created: boolean; restaurant: UserRestaurantSummary } | null> {
  const [source] = await db
    .select({
      listIsPublic: lists.isPublic,
      listOwnerId: lists.ownerId,
      placeId: userRestaurants.placeId,
      name: userRestaurants.name,
      address: userRestaurants.address,
      city: userRestaurants.city,
      countryCode: userRestaurants.countryCode,
      cuisines: userRestaurants.cuisines,
      priceLevel: userRestaurants.priceLevel,
    })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
    .where(and(eq(lists.publicSlug, slug), eq(userRestaurants.id, sourceRestaurantId)))
    .limit(1);

  if (!source || (!source.listIsPublic && source.listOwnerId !== viewerUserId)) {
    return null;
  }

  const [inserted] = await db
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

  if (!savedRow) {
    throw new Error("Could not load saved restaurant.");
  }

  return {
    created: Boolean(inserted),
    restaurant: serializeRestaurantRow(savedRow),
  };
}

/**
 * Transactionally saves any missing restaurants from a public list into `viewerUserId`'s Places
 * (`To Try`), creates an independent copy in `lists` preserving rank order, and bumps `copyCount`.
 */
export async function clonePublicListToUser(
  viewerUserId: string,
  slug: string,
  options?: { name?: string },
): Promise<{
  list: ListSummary;
  addedRestaurantsCount: number;
  totalItemsCount: number;
} | null> {
  return dbPool.transaction(async (tx) => {
    const [publicList] = await tx.select().from(lists).where(eq(lists.publicSlug, slug)).limit(1);

    if (!publicList || (!publicList.isPublic && publicList.ownerId !== viewerUserId)) {
      return null;
    }

    const orderedItems = await tx
      .select({
        placeId: userRestaurants.placeId,
        name: userRestaurants.name,
        address: userRestaurants.address,
        city: userRestaurants.city,
        countryCode: userRestaurants.countryCode,
        cuisines: userRestaurants.cuisines,
        priceLevel: userRestaurants.priceLevel,
        curatorNote: listItems.curatorNote,
      })
      .from(listItems)
      .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
      .where(eq(listItems.listId, publicList.id))
      .orderBy(asc(listItems.position), asc(listItems.addedAt));

    let addedRestaurantsCount = 0;
    const placeIds = orderedItems.map((item) => item.placeId);

    if (orderedItems.length > 0) {
      const insertedRestaurants = await tx
        .insert(userRestaurants)
        .values(
          orderedItems.map((item) => ({
            userId: viewerUserId,
            placeId: item.placeId,
            name: item.name,
            address: item.address,
            city: item.city,
            countryCode: item.countryCode,
            cuisines: item.cuisines,
            priceLevel: item.priceLevel,
            status: "to_try" as const,
          })),
        )
        .onConflictDoNothing({
          target: [userRestaurants.userId, userRestaurants.placeId],
        })
        .returning({ id: userRestaurants.id });

      addedRestaurantsCount = insertedRestaurants.length;
    }

    const viewerRows =
      placeIds.length > 0
        ? await tx
            .select({ id: userRestaurants.id, placeId: userRestaurants.placeId })
            .from(userRestaurants)
            .where(
              and(
                eq(userRestaurants.userId, viewerUserId),
                inArray(userRestaurants.placeId, placeIds),
              ),
            )
        : [];

    const viewerRestaurantByPlace = new Map<string, string>();
    for (const row of viewerRows) {
      viewerRestaurantByPlace.set(row.placeId, row.id);
    }

    const [createdList] = await tx
      .insert(lists)
      .values({
        ownerId: viewerUserId,
        name: options?.name?.trim() || publicList.name,
        description: publicList.description,
        icon: publicList.icon,
        city: publicList.city,
        isPublic: false,
        isFeatured: false,
        sourceListId: publicList.id,
      })
      .returning();

    if (!createdList) {
      throw new Error("Failed to create cloned list.");
    }

    const positions = generateNKeysBetween(null, null, orderedItems.length);
    const itemsToInsert: Array<typeof listItems.$inferInsert> = [];
    const seenViewerIds = new Set<string>();

    for (let i = 0; i < orderedItems.length; i++) {
      const sourceItem = orderedItems[i]!;
      const viewerRestaurantId = viewerRestaurantByPlace.get(sourceItem.placeId);
      if (!viewerRestaurantId || seenViewerIds.has(viewerRestaurantId)) continue;
      seenViewerIds.add(viewerRestaurantId);
      itemsToInsert.push({
        listId: createdList.id,
        userRestaurantId: viewerRestaurantId,
        addedBy: viewerUserId,
        position: positions[i]!,
        curatorNote: sourceItem.curatorNote,
      });
    }

    if (itemsToInsert.length > 0) {
      await tx.insert(listItems).values(itemsToInsert).onConflictDoNothing();
    }

    await tx
      .update(lists)
      .set({ copyCount: sql`${lists.copyCount} + 1` })
      .where(eq(lists.id, publicList.id));

    return {
      list: serializeListRow(
        createdList,
        itemsToInsert.map((item) => item.userRestaurantId),
      ),
      addedRestaurantsCount,
      totalItemsCount: itemsToInsert.length,
    };
  });
}
