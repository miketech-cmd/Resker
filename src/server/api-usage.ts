import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { apiUsage } from "@/db/schema";

export type ApiUsageKind = "resolve" | "place_details" | "autocomplete";

const DAILY_LIMITS: Record<ApiUsageKind, number> = {
  resolve: 100,
  place_details: 30,
  autocomplete: 300,
};

export class ApiRateLimitError extends Error {
  readonly status = 429;
  readonly code = "DAILY_LIMIT_REACHED";

  constructor(kind: ApiUsageKind) {
    const label =
      kind === "autocomplete"
        ? "search lookups"
        : kind === "place_details"
          ? "new place lookups"
          : "link resolves";
    super(`You've reached today's limit for ${label}. Please try again tomorrow.`);
    this.name = "ApiRateLimitError";
  }
}

/**
 * Atomically increments the per-user daily counter in `api_usage` and throws
 * `ApiRateLimitError` when the daily allowance is exceeded.
 */
export async function consumeApiQuota(userId: string, kind: ApiUsageKind): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const limit = DAILY_LIMITS[kind];

  const [row] = await db
    .insert(apiUsage)
    .values({ userId, day, kind, count: 1 })
    .onConflictDoUpdate({
      target: [apiUsage.userId, apiUsage.day, apiUsage.kind],
      set: { count: sql`${apiUsage.count} + 1` },
    })
    .returning({ count: apiUsage.count });

  const count = row?.count ?? 1;
  if (count > limit) {
    throw new ApiRateLimitError(kind);
  }

  return count;
}
