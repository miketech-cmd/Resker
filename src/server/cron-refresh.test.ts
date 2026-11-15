import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockLimit = vi.fn();
const mockWhereUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: mockLimit,
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockWhereUpdate,
      }),
    }),
  },
}));

const mockRefreshLocation = vi.fn();
vi.mock("@/server/google", () => ({
  refreshLocation: (...args: unknown[]) => mockRefreshLocation(...args),
}));

import { refreshStalePlaceLocations, verifyCronSecret } from "@/server/cron-refresh";

describe("cron-refresh", () => {
  const origSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = origSecret;
    }
  });

  it("verifies bearer cron secret with constant-time comparison", () => {
    process.env.CRON_SECRET = "super-secret-cron-token";
    expect(verifyCronSecret("Bearer super-secret-cron-token")).toBe(true);
    expect(verifyCronSecret("Bearer wrong-token")).toBe(false);
    expect(verifyCronSecret(null)).toBe(false);

    delete process.env.CRON_SECRET;
    expect(verifyCronSecret("Bearer super-secret-cron-token")).toBe(false);
  });

  it("refreshes stale places and tolerates per-place errors", async () => {
    mockLimit.mockResolvedValueOnce([
      { id: "place-1", googlePlaceId: "ChIJ1" },
      { id: "place-2", googlePlaceId: "ChIJ2" },
    ]);
    mockRefreshLocation
      .mockResolvedValueOnce({ googlePlaceId: "ChIJ1", lat: 40.71, lng: -74.0 })
      .mockRejectedValueOnce(new Error("Temporary upstream timeout"));
    mockWhereUpdate.mockResolvedValue(undefined);

    const summary = await refreshStalePlaceLocations(25);
    expect(summary).toEqual({
      scanned: 2,
      refreshed: 1,
      failed: 1,
    });
    expect(mockRefreshLocation).toHaveBeenCalledTimes(2);
    expect(mockWhereUpdate).toHaveBeenCalledTimes(1);
  });
});
