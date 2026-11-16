import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db, dbPool } from "@/db";
import { listItems, listMembers, lists, places, user, userRestaurants } from "@/db/schema";
import {
  generateKeyBetween,
  generateNKeysBetween,
  isValidPositionKey,
} from "@/lib/fractional-index";
import type {
  CreateListInput,
  InviteListMemberInput,
  ListMemberRole,
  ReorderListItemInput,
  UpdateListInput,
} from "@/lib/validation/lists";
import {
  RESTAURANT_SELECT_COLUMNS,
  saveCopiedRestaurantSpot,
  serializeRestaurantRow,
  type UserRestaurantSummary,
} from "@/server/places";

export type ListAccessRole = "owner" | "editor" | "viewer";

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
  viewerRole?: ListAccessRole;
  ownerName?: string;
  ownerUsername?: string | null;
  memberCount?: number;
  itemCount: number;
  restaurantIds: string[];
  placeIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListRestaurantItem extends UserRestaurantSummary {
  position: string;
  addedAt: string;
  isOwnedByViewer?: boolean;
  viewerRestaurantId?: string | null;
}

export interface ListMemberSummary {
  userId: string;
  name: string;
  username: string | null;
  role: ListMemberRole;
  createdAt: string;
}

export interface ListDetailData {
  list: ListSummary;
  items: ListRestaurantItem[];
  members?: ListMemberSummary[];
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

/**
 * Generates an unguessable 12-character URL-safe slug for user public share links (`/s/[slug]`).
 */
export function generatePublicSlug(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

function serializeListRow(
  row: typeof lists.$inferSelect,
  restaurantIds: string[],
  meta?: {
    viewerRole?: ListAccessRole;
    ownerName?: string;
    ownerUsername?: string | null;
    memberCount?: number;
    placeIds?: string[];
  },
): ListSummary {
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
    viewerRole: meta?.viewerRole ?? "owner",
    ownerName: meta?.ownerName,
    ownerUsername: meta?.ownerUsername,
    memberCount: meta?.memberCount ?? 0,
    itemCount: restaurantIds.length,
    restaurantIds,
    placeIds: meta?.placeIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getListAccessRole(
  userId: string,
  listId: string,
): Promise<{ list: typeof lists.$inferSelect; role: ListAccessRole } | null> {
  const [listRow] = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
  if (!listRow) return null;
  if (listRow.ownerId === userId) {
    return { list: listRow, role: "owner" };
  }

  const [memberRow] = await db
    .select({ role: listMembers.role })
    .from(listMembers)
    .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId)))
    .limit(1);

  if (!memberRow) return null;
  return { list: listRow, role: memberRow.role };
}

export async function canReadList(userId: string, listId: string): Promise<boolean> {
  return (await getListAccessRole(userId, listId)) !== null;
}

export async function canEditList(userId: string, listId: string): Promise<boolean> {
  const access = await getListAccessRole(userId, listId);
  return access?.role === "owner" || access?.role === "editor";
}

export async function canManageList(userId: string, listId: string): Promise<boolean> {
  const access = await getListAccessRole(userId, listId);
  return access?.role === "owner";
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
 * Returns all lists owned by or shared with `userId` alongside ordered restaurant & place IDs
 * so `/lists` and `AddToListsSheet` enforce role-aware membership cleanly.
 */
export async function getUserLists(userId: string): Promise<ListSummary[]> {
  const [ownedRows, sharedRows] = await Promise.all([
    db
      .select({
        list: lists,
        ownerName: user.name,
        ownerUsername: user.displayUsername,
      })
      .from(lists)
      .innerJoin(user, eq(lists.ownerId, user.id))
      .where(eq(lists.ownerId, userId)),
    db
      .select({
        list: lists,
        role: listMembers.role,
        ownerName: user.name,
        ownerUsername: user.displayUsername,
      })
      .from(listMembers)
      .innerJoin(lists, eq(listMembers.listId, lists.id))
      .innerJoin(user, eq(lists.ownerId, user.id))
      .where(eq(listMembers.userId, userId)),
  ]);

  const combined = new Map<
    string,
    {
      list: typeof lists.$inferSelect;
      role: ListAccessRole;
      ownerName: string;
      ownerUsername: string | null;
    }
  >();

  for (const row of ownedRows) {
    combined.set(row.list.id, {
      list: row.list,
      role: "owner",
      ownerName: row.ownerName,
      ownerUsername: row.ownerUsername,
    });
  }
  for (const row of sharedRows) {
    if (!combined.has(row.list.id)) {
      combined.set(row.list.id, {
        list: row.list,
        role: row.role,
        ownerName: row.ownerName,
        ownerUsername: row.ownerUsername,
      });
    }
  }

  const orderedEntries = Array.from(combined.values()).sort(
    (a, b) => b.list.updatedAt.getTime() - a.list.updatedAt.getTime(),
  );

  if (orderedEntries.length === 0) {
    return [];
  }

  const listIds = orderedEntries.map((entry) => entry.list.id);
  const [membershipRows, collaboratorCounts] = await Promise.all([
    db
      .select({
        listId: listItems.listId,
        userRestaurantId: listItems.userRestaurantId,
        placeId: userRestaurants.placeId,
      })
      .from(listItems)
      .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
      .where(inArray(listItems.listId, listIds))
      .orderBy(asc(listItems.position), asc(listItems.addedAt)),
    db
      .select({
        listId: listMembers.listId,
        count: sql<number>`count(*)::int`,
      })
      .from(listMembers)
      .where(inArray(listMembers.listId, listIds))
      .groupBy(listMembers.listId),
  ]);

  const idsByList = new Map<string, string[]>();
  const placeIdsByList = new Map<string, string[]>();
  for (const row of membershipRows) {
    const ids = idsByList.get(row.listId) ?? [];
    ids.push(row.userRestaurantId);
    idsByList.set(row.listId, ids);

    const pIds = placeIdsByList.get(row.listId) ?? [];
    pIds.push(row.placeId);
    placeIdsByList.set(row.listId, pIds);
  }

  const memberCountByList = new Map<string, number>();
  for (const row of collaboratorCounts) {
    memberCountByList.set(row.listId, row.count);
  }

  return orderedEntries.map(({ list, role, ownerName, ownerUsername }) =>
    serializeListRow(list, idsByList.get(list.id) ?? [], {
      viewerRole: role,
      ownerName,
      ownerUsername,
      memberCount: memberCountByList.get(list.id) ?? 0,
      placeIds: placeIdsByList.get(list.id) ?? [],
    }),
  );
}

/**
 * Returns one list readable by `userId` (owner, editor, or viewer), masking other users'
 * personal ratings, notes, statuses, and visit logs while annotating viewer's own saved copy.
 */
export async function getListDetail(
  userId: string,
  listId: string,
): Promise<ListDetailData | null> {
  const access = await getListAccessRole(userId, listId);
  if (!access) {
    return null;
  }

  const [ownerRow, rows, memberRows] = await Promise.all([
    db
      .select({ name: user.name, username: user.displayUsername })
      .from(user)
      .where(eq(user.id, access.list.ownerId))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        ...RESTAURANT_SELECT_COLUMNS,
        rowUserId: userRestaurants.userId,
        position: listItems.position,
        addedAt: listItems.addedAt,
      })
      .from(listItems)
      .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
      .innerJoin(places, eq(userRestaurants.placeId, places.id))
      .where(eq(listItems.listId, listId))
      .orderBy(asc(listItems.position), asc(listItems.addedAt)),
    db
      .select({
        userId: listMembers.userId,
        name: user.name,
        username: user.displayUsername,
        role: listMembers.role,
        createdAt: listMembers.createdAt,
      })
      .from(listMembers)
      .innerJoin(user, eq(listMembers.userId, user.id))
      .where(eq(listMembers.listId, listId))
      .orderBy(asc(listMembers.createdAt)),
  ]);

  const placeIds = Array.from(new Set(rows.map((r) => r.placeId)));
  const viewerSavedRows =
    placeIds.length > 0
      ? await db
          .select({ id: userRestaurants.id, placeId: userRestaurants.placeId })
          .from(userRestaurants)
          .where(
            and(eq(userRestaurants.userId, userId), inArray(userRestaurants.placeId, placeIds)),
          )
      : [];
  const viewerRestaurantByPlace = new Map<string, string>();
  for (const r of viewerSavedRows) {
    viewerRestaurantByPlace.set(r.placeId, r.id);
  }

  const items: ListRestaurantItem[] = rows.map((row) => {
    const ownedByViewer = row.rowUserId === userId;
    const base = serializeRestaurantRow(row);
    const sanitized = ownedByViewer
      ? base
      : {
          ...base,
          status: "to_try" as const,
          ratingHalf: null,
          notes: null,
          visitCount: 0,
          lastVisitedOn: null,
        };
    return {
      ...sanitized,
      position: row.position,
      addedAt: row.addedAt.toISOString(),
      isOwnedByViewer: ownedByViewer,
      viewerRestaurantId: viewerRestaurantByPlace.get(row.placeId) ?? null,
    };
  });

  return {
    list: serializeListRow(
      access.list,
      items.map((item) => item.id),
      {
        viewerRole: access.role,
        ownerName: ownerRow?.name,
        ownerUsername: ownerRow?.username ?? null,
        memberCount: memberRows.length,
        placeIds,
      },
    ),
    items,
    members: memberRows.map((m) => ({
      userId: m.userId,
      name: m.name,
      username: m.username,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    })),
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
      publicSlug: isPublic ? generatePublicSlug() : null,
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
  if (input.revokeSlug) {
    updates.isPublic = false;
    updates.publicSlug = null;
  } else if (input.regenerateSlug) {
    updates.isPublic = true;
    updates.publicSlug = generatePublicSlug();
  } else if (input.isPublic !== undefined) {
    updates.isPublic = input.isPublic;
    if (input.isPublic && !existing.publicSlug) {
      updates.publicSlug = generatePublicSlug();
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

  const [membershipRows, memberCountRow] = await Promise.all([
    db
      .select({ userRestaurantId: listItems.userRestaurantId })
      .from(listItems)
      .where(eq(listItems.listId, listId))
      .orderBy(asc(listItems.position), asc(listItems.addedAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(listMembers)
      .where(eq(listMembers.listId, listId))
      .then((r) => r[0]?.count ?? 0),
  ]);

  return serializeListRow(
    updated,
    membershipRows.map((r) => r.userRestaurantId),
    { viewerRole: "owner", memberCount: memberCountRow },
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
): Promise<{ added: boolean; position: string; forbidden?: never } | { forbidden: true } | null> {
  const access = await getListAccessRole(userId, listId);
  if (!access) return null;
  if (access.role === "viewer") return { forbidden: true };

  const [ownedRestaurant, existingItems] = await Promise.all([
    db
      .select({ id: userRestaurants.id, placeId: userRestaurants.placeId })
      .from(userRestaurants)
      .where(and(eq(userRestaurants.id, userRestaurantId), eq(userRestaurants.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        userRestaurantId: listItems.userRestaurantId,
        placeId: userRestaurants.placeId,
        position: listItems.position,
      })
      .from(listItems)
      .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
      .where(eq(listItems.listId, listId))
      .orderBy(asc(listItems.position), asc(listItems.addedAt)),
  ]);

  if (!ownedRestaurant) {
    return null;
  }

  const duplicate = existingItems.find(
    (item) =>
      item.userRestaurantId === userRestaurantId || item.placeId === ownedRestaurant.placeId,
  );
  if (duplicate) {
    return { added: false, position: duplicate.position };
  }

  const lastPosition = existingItems[existingItems.length - 1]?.position ?? null;
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

  await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));

  return { added: true, position: nextPosition };
}

export async function removeRestaurantFromList(
  userId: string,
  listId: string,
  userRestaurantId: string,
): Promise<{ removed: boolean; forbidden?: never } | { forbidden: true } | null> {
  const access = await getListAccessRole(userId, listId);
  if (!access) return null;
  if (access.role === "viewer") return { forbidden: true };

  // Match direct item ID or same place added under viewer's own restaurant ID on shared lists
  let targetItemId = userRestaurantId;
  const [directMatch] = await db
    .select({ userRestaurantId: listItems.userRestaurantId })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.userRestaurantId, userRestaurantId)))
    .limit(1);

  if (!directMatch) {
    const [viewerRest] = await db
      .select({ placeId: userRestaurants.placeId })
      .from(userRestaurants)
      .where(and(eq(userRestaurants.id, userRestaurantId), eq(userRestaurants.userId, userId)))
      .limit(1);

    if (viewerRest) {
      const [samePlaceMatch] = await db
        .select({ userRestaurantId: listItems.userRestaurantId })
        .from(listItems)
        .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
        .where(and(eq(listItems.listId, listId), eq(userRestaurants.placeId, viewerRest.placeId)))
        .limit(1);
      if (samePlaceMatch) {
        targetItemId = samePlaceMatch.userRestaurantId;
      }
    }
  }

  const [deleted] = await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.userRestaurantId, targetItemId)))
    .returning({ userRestaurantId: listItems.userRestaurantId });

  if (deleted) {
    await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));
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
): Promise<{ position: string; forbidden?: never } | { forbidden: true } | null> {
  const access = await getListAccessRole(userId, listId);
  if (!access) return null;
  if (access.role === "viewer") return { forbidden: true };

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

  await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));

  return { position: nextPosition };
}

export async function getListMembers(
  userId: string,
  listId: string,
): Promise<ListMemberSummary[] | null> {
  if (!(await canReadList(userId, listId))) {
    return null;
  }

  const rows = await db
    .select({
      userId: listMembers.userId,
      name: user.name,
      username: user.displayUsername,
      role: listMembers.role,
      createdAt: listMembers.createdAt,
    })
    .from(listMembers)
    .innerJoin(user, eq(listMembers.userId, user.id))
    .where(eq(listMembers.listId, listId))
    .orderBy(asc(listMembers.createdAt));

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function inviteListMember(
  ownerId: string,
  listId: string,
  input: InviteListMemberInput,
): Promise<
  | { status: "ok"; member: ListMemberSummary }
  | { status: "not_found" | "forbidden" | "user_not_found" | "self_invite" }
> {
  const access = await getListAccessRole(ownerId, listId);
  if (!access) return { status: "not_found" };
  if (access.role !== "owner") return { status: "forbidden" };

  const [targetUser] = await db
    .select({ id: user.id, name: user.name, username: user.displayUsername })
    .from(user)
    .where(eq(user.username, input.username))
    .limit(1);

  if (!targetUser) {
    return { status: "user_not_found" };
  }
  if (targetUser.id === ownerId) {
    return { status: "self_invite" };
  }

  const [upserted] = await db
    .insert(listMembers)
    .values({
      listId,
      userId: targetUser.id,
      role: input.role,
      invitedBy: ownerId,
    })
    .onConflictDoUpdate({
      target: [listMembers.listId, listMembers.userId],
      set: { role: input.role, invitedBy: ownerId },
    })
    .returning();

  return {
    status: "ok",
    member: {
      userId: targetUser.id,
      name: targetUser.name,
      username: targetUser.username,
      role: upserted?.role ?? input.role,
      createdAt: (upserted?.createdAt ?? new Date()).toISOString(),
    },
  };
}

export async function updateListMemberRole(
  ownerId: string,
  listId: string,
  targetUserId: string,
  role: ListMemberRole,
): Promise<{ status: "ok"; role: ListMemberRole } | { status: "not_found" | "forbidden" }> {
  const access = await getListAccessRole(ownerId, listId);
  if (!access) return { status: "not_found" };
  if (access.role !== "owner") return { status: "forbidden" };

  const [updated] = await db
    .update(listMembers)
    .set({ role })
    .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, targetUserId)))
    .returning({ role: listMembers.role });

  if (!updated) {
    return { status: "not_found" };
  }
  return { status: "ok", role: updated.role };
}

export async function removeListMember(
  actorUserId: string,
  listId: string,
  targetUserId: string,
): Promise<{ status: "ok" } | { status: "not_found" | "forbidden" }> {
  const access = await getListAccessRole(actorUserId, listId);
  if (!access) return { status: "not_found" };

  const canRemove = access.role === "owner" || actorUserId === targetUserId;
  if (!canRemove) return { status: "forbidden" };

  const [deleted] = await db
    .delete(listMembers)
    .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, targetUserId)))
    .returning({ userId: listMembers.userId });

  return deleted ? { status: "ok" } : { status: "not_found" };
}

export async function saveSpotFromSharedList(
  viewerUserId: string,
  listId: string,
  sourceRestaurantId: string,
): Promise<{ created: boolean; restaurant: UserRestaurantSummary } | null> {
  if (!(await canReadList(viewerUserId, listId))) {
    return null;
  }

  const [source] = await db
    .select({
      placeId: userRestaurants.placeId,
      name: userRestaurants.name,
      address: userRestaurants.address,
      city: userRestaurants.city,
      countryCode: userRestaurants.countryCode,
      cuisines: userRestaurants.cuisines,
      priceLevel: userRestaurants.priceLevel,
    })
    .from(listItems)
    .innerJoin(userRestaurants, eq(listItems.userRestaurantId, userRestaurants.id))
    .where(and(eq(listItems.listId, listId), eq(listItems.userRestaurantId, sourceRestaurantId)))
    .limit(1);

  if (!source) return null;

  return saveCopiedRestaurantSpot(viewerUserId, source);
}

export function collectTopCuisines(cuisinesLists: string[][]): string[] {
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
