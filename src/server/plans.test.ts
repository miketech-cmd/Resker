import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockDbSelectQueue: Array<unknown[]> = [];
const mockTxSelectQueue: Array<unknown[]> = [];
const mockTxUpdateSpy = vi.fn();
const mockInsertVisitInTx = vi.fn();
const mockGetUserRestaurantById = vi.fn();

function makeSelectChain(queue: Array<unknown[]>) {
  return {
    limit: vi.fn(async () => queue.shift() ?? []),
    orderBy: vi.fn(async () => queue.shift() ?? []),
  };
}

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => makeSelectChain(mockDbSelectQueue),
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => makeSelectChain(mockDbSelectQueue),
          }),
        }),
      }),
    }),
  },
  dbPool: {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => makeSelectChain(mockTxSelectQueue),
          }),
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => {
            mockTxUpdateSpy(values);
            return {
              where: async () => [],
            };
          },
        }),
      };
      return callback(tx);
    },
  },
}));

vi.mock("@/server/visits", () => ({
  insertVisitInTx: (...args: unknown[]) => mockInsertVisitInTx(...args),
}));

vi.mock("@/server/places", () => ({
  getUserRestaurantById: (...args: unknown[]) => mockGetUserRestaurantById(...args),
}));

import { completePlannedVisit, createPlannedVisit } from "@/server/plans";

const USER_ID = "user-1";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PLACE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VISIT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function makePlanJoinRow(status: "planned" | "done" | "cancelled", visitId: string | null) {
  return {
    plan: {
      id: PLAN_ID,
      userRestaurantId: REST_ID,
      userId: USER_ID,
      plannedFor: "2026-11-20",
      plannedTime: "19:30:00",
      note: "Patio seating",
      status,
      visitId,
      createdAt: new Date("2026-11-15T10:00:00.000Z"),
    },
    restaurant: {
      id: REST_ID,
      userId: USER_ID,
      placeId: PLACE_ID,
      name: "Hangawi",
      address: "12 E 32nd St, New York, NY",
      city: "New York",
      countryCode: "US",
      cuisines: ["Korean", "Vegan"],
      priceLevel: 3,
      status: status === "done" ? ("tried" as const) : ("to_try" as const),
      ratingHalf: null,
      notes: null,
      visitCount: status === "done" ? 1 : 0,
      lastVisitedOn: status === "done" ? "2026-11-20" : null,
      createdAt: new Date("2026-11-14T00:00:00.000Z"),
      updatedAt: new Date("2026-11-15T10:00:00.000Z"),
    },
    place: {
      id: PLACE_ID,
      googlePlaceId: "ChIJ-hangawi",
      googleMapsUri: "https://maps.google.com/?cid=1",
      lat: 40.7468,
      lng: -73.9846,
    },
  };
}

describe("Phase 9 planned visits server workflows", () => {
  beforeEach(() => {
    mockDbSelectQueue.length = 0;
    mockTxSelectQueue.length = 0;
    mockTxUpdateSpy.mockClear();
    mockInsertVisitInTx.mockReset();
    mockGetUserRestaurantById.mockReset();
  });

  it("rejects creating a planned visit when user does not own the restaurant", async () => {
    mockDbSelectQueue.push([]);
    const created = await createPlannedVisit(USER_ID, {
      userRestaurantId: REST_ID,
      plannedFor: "2026-11-20",
      plannedTime: "19:30",
      note: null,
    });
    expect(created).toBeNull();
  });

  it("atomically creates a visit, sets status=done & visitId, and promotes restaurant", async () => {
    mockTxSelectQueue.push([
      {
        id: PLAN_ID,
        userRestaurantId: REST_ID,
        userId: USER_ID,
        plannedFor: "2026-11-20",
        plannedTime: "19:30:00",
        note: "Patio seating",
        status: "planned",
        visitId: null,
        createdAt: new Date("2026-11-15T10:00:00.000Z"),
      },
    ]);

    const createdVisit = {
      id: VISIT_ID,
      userRestaurantId: REST_ID,
      visitedOn: "2026-11-20",
      ratingHalf: null,
      notes: "Patio seating",
      dishes: [],
      createdAt: "2026-11-15T11:00:00.000Z",
      updatedAt: "2026-11-15T11:00:00.000Z",
    };
    mockInsertVisitInTx.mockResolvedValueOnce(createdVisit);
    mockDbSelectQueue.push([makePlanJoinRow("done", VISIT_ID)]);
    mockGetUserRestaurantById.mockResolvedValueOnce({
      id: REST_ID,
      placeId: PLACE_ID,
      googlePlaceId: "ChIJ-hangawi",
      googleMapsUri: "https://maps.google.com/?cid=1",
      lat: 40.7468,
      lng: -73.9846,
      name: "Hangawi",
      address: "12 E 32nd St, New York, NY",
      city: "New York",
      countryCode: "US",
      cuisines: ["Korean", "Vegan"],
      priceLevel: 3,
      status: "tried",
      ratingHalf: null,
      notes: null,
      visitCount: 1,
      lastVisitedOn: "2026-11-20",
      createdAt: "2026-11-14T00:00:00.000Z",
      updatedAt: "2026-11-15T11:00:00.000Z",
    });

    const result = await completePlannedVisit(USER_ID, PLAN_ID, { dishes: [] });

    expect(result).not.toBeNull();
    expect(result?.alreadyCompleted).toBe(false);
    expect(result?.visit?.id).toBe(VISIT_ID);
    expect(result?.restaurant.status).toBe("tried");
    expect(result?.restaurant.visitCount).toBe(1);
    expect(mockInsertVisitInTx).toHaveBeenCalledWith(expect.anything(), USER_ID, REST_ID, {
      visitedOn: "2026-11-20",
      ratingHalf: null,
      notes: "Patio seating",
      dishes: [],
    });
    expect(mockTxUpdateSpy).toHaveBeenCalledWith({
      status: "done",
      visitId: VISIT_ID,
    });
  });

  it("is idempotent when plan is already done with a linked visitId", async () => {
    mockTxSelectQueue.push([
      {
        id: PLAN_ID,
        userRestaurantId: REST_ID,
        userId: USER_ID,
        plannedFor: "2026-11-20",
        plannedTime: "19:30:00",
        note: "Patio seating",
        status: "done",
        visitId: VISIT_ID,
        createdAt: new Date("2026-11-15T10:00:00.000Z"),
      },
    ]);
    mockDbSelectQueue.push([makePlanJoinRow("done", VISIT_ID)]);
    mockGetUserRestaurantById.mockResolvedValueOnce({
      id: REST_ID,
      status: "tried",
      visitCount: 1,
    });

    const result = await completePlannedVisit(USER_ID, PLAN_ID, { dishes: [] });

    expect(result?.alreadyCompleted).toBe(true);
    expect(result?.visit).toBeNull();
    expect(mockInsertVisitInTx).not.toHaveBeenCalled();
    expect(mockTxUpdateSpy).not.toHaveBeenCalled();
  });
});
