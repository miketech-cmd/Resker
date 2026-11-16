import "server-only";

import { randomBytes } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { libraryShareLinks, libraryShares, places, user, userRestaurants } from "@/db/schema";
import { collectTopCuisines } from "@/server/lists";
import { saveCopiedRestaurantSpot, type UserRestaurantSummary } from "@/server/places";

export interface LibraryViewerSummary {
  userId: string;
  name: string;
  username: string | null;
  createdAt: string;
}

export interface SharedLibraryGuideSummary {
  ownerId: string;
  ownerName: string;
  ownerUsername: string | null;
  itemCount: number;
  citiesCount: number;
  cuisines: string[];
  sharedAt: string;
}

export interface SharedGuidesOverviewData {
  sharedWithMe: SharedLibraryGuideSummary[];
  sharingWith: LibraryViewerSummary[];
  inviteToken: string | null;
  myLibraryCount: number;
}

export interface SharedLibraryRestaurantItem {
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

export interface SharedLibraryGuideDetailData {
  guide: SharedLibraryGuideSummary;
  items: SharedLibraryRestaurantItem[];
  isOwnPreview: boolean;
}

export interface LibraryInvitePreviewData {
  token: string;
  ownerId: string;
  ownerName: string;
  ownerUsername: string | null;
  itemCount: number;
  isOwnLink: boolean;
  alreadyConnected: boolean;
}

export function generateLibraryInviteToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

/**
 * Fetches everything needed for the Shared Guides tab and management sheet:
 * - Other users' live libraries shared with `userId` (`sharedWithMe`)
 * - Users `userId` currently shares their own library with (`sharingWith`)
 * - Owner's private invite token (`inviteToken`) & spot count (`myLibraryCount`)
 */
export async function getSharedGuidesOverviewData(
  userId: string,
): Promise<SharedGuidesOverviewData> {
  const [incomingRows, outgoingRows, linkRows, countRows] = await Promise.all([
    db
      .select({
        ownerId: libraryShares.ownerId,
        sharedAt: libraryShares.createdAt,
        ownerName: user.name,
        ownerUsername: user.displayUsername,
      })
      .from(libraryShares)
      .innerJoin(user, eq(libraryShares.ownerId, user.id))
      .where(eq(libraryShares.viewerId, userId))
      .orderBy(desc(libraryShares.createdAt)),
    db
      .select({
        userId: libraryShares.viewerId,
        name: user.name,
        username: user.displayUsername,
        createdAt: libraryShares.createdAt,
      })
      .from(libraryShares)
      .innerJoin(user, eq(libraryShares.viewerId, user.id))
      .where(eq(libraryShares.ownerId, userId))
      .orderBy(desc(libraryShares.createdAt)),
    db
      .select({ token: libraryShareLinks.token })
      .from(libraryShareLinks)
      .where(eq(libraryShareLinks.ownerId, userId))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRestaurants)
      .where(eq(userRestaurants.userId, userId)),
  ]);

  const ownerIds = incomingRows.map((row) => row.ownerId);
  const metaByOwner = new Map<
    string,
    { count: number; cities: Set<string>; cuisinesList: string[][] }
  >();

  if (ownerIds.length > 0) {
    const ownerSpotRows = await db
      .select({
        userId: userRestaurants.userId,
        city: userRestaurants.city,
        cuisines: userRestaurants.cuisines,
      })
      .from(userRestaurants)
      .where(inArray(userRestaurants.userId, ownerIds));

    for (const spot of ownerSpotRows) {
      let bucket = metaByOwner.get(spot.userId);
      if (!bucket) {
        bucket = { count: 0, cities: new Set(), cuisinesList: [] };
        metaByOwner.set(spot.userId, bucket);
      }
      bucket.count += 1;
      const cleanCity = spot.city?.trim().toLowerCase();
      if (cleanCity) bucket.cities.add(cleanCity);
      if (spot.cuisines?.length) bucket.cuisinesList.push(spot.cuisines);
    }
  }

  return {
    sharedWithMe: incomingRows.map((row) => {
      const meta = metaByOwner.get(row.ownerId);
      return {
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        ownerUsername: row.ownerUsername,
        itemCount: meta?.count ?? 0,
        citiesCount: meta?.cities.size ?? 0,
        cuisines: meta ? collectTopCuisines(meta.cuisinesList) : [],
        sharedAt: row.sharedAt.toISOString(),
      };
    }),
    sharingWith: outgoingRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      username: row.username,
      createdAt: row.createdAt.toISOString(),
    })),
    inviteToken: linkRows[0]?.token ?? null,
    myLibraryCount: countRows[0]?.count ?? 0,
  };
}

/**
 * Loads sanitized live-library spots for an authorized viewer (strictly excluding private
 * status, ratingHalf, tasting notes, visit counts, and visit history).
 */
export async function getSharedLibraryGuideDetail(
  viewerId: string,
  ownerId: string,
): Promise<SharedLibraryGuideDetailData | null> {
  const isOwnPreview = viewerId === ownerId;

  let sharedAt = new Date();
  if (!isOwnPreview) {
    const [shareRow] = await db
      .select({ createdAt: libraryShares.createdAt })
      .from(libraryShares)
      .where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.viewerId, viewerId)))
      .limit(1);

    if (!shareRow) {
      return null;
    }
    sharedAt = shareRow.createdAt;
  }

  const [ownerRow] = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.displayUsername,
    })
    .from(user)
    .where(eq(user.id, ownerId))
    .limit(1);

  if (!ownerRow) {
    return null;
  }

  const [spotRows, viewerOwnedRows] = await Promise.all([
    db
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
        createdAt: userRestaurants.createdAt,
      })
      .from(userRestaurants)
      .innerJoin(places, eq(userRestaurants.placeId, places.id))
      .where(eq(userRestaurants.userId, ownerId))
      .orderBy(desc(userRestaurants.updatedAt)),
    isOwnPreview
      ? Promise.resolve([])
      : db
          .select({ id: userRestaurants.id, placeId: userRestaurants.placeId })
          .from(userRestaurants)
          .where(eq(userRestaurants.userId, viewerId)),
  ]);

  const viewerByPlaceId = new Map(viewerOwnedRows.map((row) => [row.placeId, row.id]));
  const citySet = new Set<string>();
  const cuisinesList: string[][] = [];

  const items: SharedLibraryRestaurantItem[] = spotRows.map((row, idx) => {
    const cleanCity = row.city?.trim().toLowerCase();
    if (cleanCity) citySet.add(cleanCity);
    if (row.cuisines?.length) cuisinesList.push(row.cuisines);

    const viewerRestId = isOwnPreview ? row.id : (viewerByPlaceId.get(row.placeId) ?? null);
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
      cuisines: row.cuisines ?? [],
      priceLevel: row.priceLevel,
      curatorNote: null,
      position: String(idx),
      addedAt: row.createdAt.toISOString(),
      savedByViewer: Boolean(viewerRestId),
      viewerRestaurantId: viewerRestId,
    };
  });

  return {
    guide: {
      ownerId: ownerRow.id,
      ownerName: ownerRow.name,
      ownerUsername: ownerRow.username,
      itemCount: items.length,
      citiesCount: citySet.size,
      cuisines: collectTopCuisines(cuisinesList),
      sharedAt: sharedAt.toISOString(),
    },
    items,
    isOwnPreview,
  };
}

export async function inviteLibraryViewer(
  ownerId: string,
  username: string,
): Promise<
  { status: "not_found" } | { status: "self" } | { status: "ok"; viewer: LibraryViewerSummary }
> {
  const normalized = username.replace(/^@+/, "").trim().toLowerCase();
  const [targetUser] = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.displayUsername,
    })
    .from(user)
    .where(eq(user.username, normalized))
    .limit(1);

  if (!targetUser) {
    return { status: "not_found" };
  }

  if (targetUser.id === ownerId) {
    return { status: "self" };
  }

  const now = new Date();
  await db
    .insert(libraryShares)
    .values({
      ownerId,
      viewerId: targetUser.id,
      createdAt: now,
    })
    .onConflictDoNothing({
      target: [libraryShares.ownerId, libraryShares.viewerId],
    });

  const [shareRow] = await db
    .select({ createdAt: libraryShares.createdAt })
    .from(libraryShares)
    .where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.viewerId, targetUser.id)))
    .limit(1);

  return {
    status: "ok",
    viewer: {
      userId: targetUser.id,
      name: targetUser.name,
      username: targetUser.username,
      createdAt: (shareRow?.createdAt ?? now).toISOString(),
    },
  };
}

export async function removeLibraryViewer(
  ownerId: string,
  viewerId: string,
): Promise<{ deleted: boolean }> {
  const deleted = await db
    .delete(libraryShares)
    .where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.viewerId, viewerId)))
    .returning({ viewerId: libraryShares.viewerId });

  return { deleted: deleted.length > 0 };
}

export async function createOrRotateLibraryInviteToken(ownerId: string): Promise<string> {
  const token = generateLibraryInviteToken();
  await db
    .insert(libraryShareLinks)
    .values({
      ownerId,
      token,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: libraryShareLinks.ownerId,
      set: {
        token,
        createdAt: new Date(),
      },
    });
  return token;
}

export async function revokeLibraryInviteToken(ownerId: string): Promise<void> {
  await db.delete(libraryShareLinks).where(eq(libraryShareLinks.ownerId, ownerId));
}

export async function getLibraryInvitePreview(
  viewerId: string,
  token: string,
): Promise<LibraryInvitePreviewData | null> {
  const [linkRow] = await db
    .select({
      ownerId: libraryShareLinks.ownerId,
      token: libraryShareLinks.token,
      ownerName: user.name,
      ownerUsername: user.displayUsername,
    })
    .from(libraryShareLinks)
    .innerJoin(user, eq(libraryShareLinks.ownerId, user.id))
    .where(eq(libraryShareLinks.token, token))
    .limit(1);

  if (!linkRow) {
    return null;
  }

  const isOwnLink = linkRow.ownerId === viewerId;

  const [[countRow], [shareRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRestaurants)
      .where(eq(userRestaurants.userId, linkRow.ownerId)),
    isOwnLink
      ? Promise.resolve([])
      : db
          .select({ ownerId: libraryShares.ownerId })
          .from(libraryShares)
          .where(
            and(eq(libraryShares.ownerId, linkRow.ownerId), eq(libraryShares.viewerId, viewerId)),
          )
          .limit(1),
  ]);

  return {
    token: linkRow.token,
    ownerId: linkRow.ownerId,
    ownerName: linkRow.ownerName,
    ownerUsername: linkRow.ownerUsername,
    itemCount: countRow?.count ?? 0,
    isOwnLink,
    alreadyConnected: Boolean(shareRow),
  };
}

export async function acceptLibraryInviteToken(
  viewerId: string,
  token: string,
): Promise<
  | { status: "not_found" }
  | { status: "self" }
  | { status: "ok"; ownerId: string; ownerName: string; ownerUsername: string | null }
> {
  const [linkRow] = await db
    .select({
      ownerId: libraryShareLinks.ownerId,
      ownerName: user.name,
      ownerUsername: user.displayUsername,
    })
    .from(libraryShareLinks)
    .innerJoin(user, eq(libraryShareLinks.ownerId, user.id))
    .where(eq(libraryShareLinks.token, token))
    .limit(1);

  if (!linkRow) {
    return { status: "not_found" };
  }

  if (linkRow.ownerId === viewerId) {
    return { status: "self" };
  }

  await db
    .insert(libraryShares)
    .values({
      ownerId: linkRow.ownerId,
      viewerId,
    })
    .onConflictDoNothing({
      target: [libraryShares.ownerId, libraryShares.viewerId],
    });

  return {
    status: "ok",
    ownerId: linkRow.ownerId,
    ownerName: linkRow.ownerName,
    ownerUsername: linkRow.ownerUsername,
  };
}

export async function saveSpotFromSharedLibrary(
  viewerId: string,
  ownerId: string,
  sourceRestaurantId: string,
): Promise<{ created: boolean; restaurant: UserRestaurantSummary } | null> {
  const [shareRow] = await db
    .select({ ownerId: libraryShares.ownerId })
    .from(libraryShares)
    .where(and(eq(libraryShares.ownerId, ownerId), eq(libraryShares.viewerId, viewerId)))
    .limit(1);

  if (!shareRow && viewerId !== ownerId) {
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
    .from(userRestaurants)
    .where(and(eq(userRestaurants.id, sourceRestaurantId), eq(userRestaurants.userId, ownerId)))
    .limit(1);

  if (!source) {
    return null;
  }

  return saveCopiedRestaurantSpot(viewerId, source);
}
