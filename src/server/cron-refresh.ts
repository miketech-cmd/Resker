import "server-only";

import { timingSafeEqual } from "node:crypto";

import { asc, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { places } from "@/db/schema";
import { refreshLocation } from "@/server/google";

const TWENTY_FIVE_DAYS_MS = 25 * 24 * 60 * 60 * 1000;
const CHUNK_SIZE = 5;

export interface CronRefreshResult {
  scanned: number;
  refreshed: number;
  failed: number;
}

/**
 * Constant-time check against `Authorization: Bearer ${CRON_SECRET}`.
 * Fails closed when `CRON_SECRET` is unset or empty.
 */
export function verifyCronSecret(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !authorizationHeader) {
    return false;
  }

  const expected = `Bearer ${secret}`;
  const actualBuf = Buffer.from(authorizationHeader, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Queries up to `batchSize` places whose coordinates are missing or older than 25 days,
 * refreshes coordinates via Essentials-tier Place Details (`id,location`), and updates `places`.
 */
export async function refreshStalePlaceLocations(batchSize = 25): Promise<CronRefreshResult> {
  const cutoff = new Date(Date.now() - TWENTY_FIVE_DAYS_MS);

  const stalePlaces = await db
    .select({
      id: places.id,
      googlePlaceId: places.googlePlaceId,
    })
    .from(places)
    .where(or(isNull(places.locationFetchedAt), lt(places.locationFetchedAt, cutoff)))
    .orderBy(asc(places.locationFetchedAt))
    .limit(batchSize);

  if (stalePlaces.length === 0) {
    return { scanned: 0, refreshed: 0, failed: 0 };
  }

  let refreshed = 0;
  let failed = 0;

  for (let i = 0; i < stalePlaces.length; i += CHUNK_SIZE) {
    const chunk = stalePlaces.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        const coords = await refreshLocation(row.googlePlaceId);
        if (coords.lat === null || coords.lng === null) {
          return false;
        }
        await db
          .update(places)
          .set({
            lat: coords.lat,
            lng: coords.lng,
            locationFetchedAt: new Date(),
          })
          .where(eq(places.id, row.id));
        return true;
      }),
    );

    for (const outcome of results) {
      if (outcome.status === "fulfilled" && outcome.value) {
        refreshed += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    scanned: stalePlaces.length,
    refreshed,
    failed,
  };
}
