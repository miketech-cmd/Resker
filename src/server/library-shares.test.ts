import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockDbSelectQueue: Array<unknown[]> = [];
const mockInsertValuesSpy = vi.fn();
const mockSaveCopiedRestaurantSpot = vi.fn();

function makeWhereChain() {
  let consumed = false;
  const take = () => {
    consumed = true;
    return mockDbSelectQueue.shift() ?? [];
  };
  return {
    limit: vi.fn(async () => take()),
    orderBy: vi.fn(async () => take()),
    then(onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) {
      const value = consumed ? [] : take();
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
}

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => makeWhereChain(),
        innerJoin: () => ({
          where: () => makeWhereChain(),
        }),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        mockInsertValuesSpy(vals);
        return {
          onConflictDoNothing: async () => [],
          onConflictDoUpdate: async () => [],
        };
      },
    }),
  },
}));

vi.mock("@/server/places", () => ({
  saveCopiedRestaurantSpot: (...args: unknown[]) => mockSaveCopiedRestaurantSpot(...args),
}));

vi.mock("@/server/lists", () => ({
  collectTopCuisines: (lists: string[][]) => lists.flat().slice(0, 6),
}));

import {
  acceptLibraryInviteToken,
  getSharedLibraryGuideDetail,
  inviteLibraryViewer,
  saveSpotFromSharedLibrary,
} from "@/server/library-shares";

describe("Shared Guides (library_shares) server logic", () => {
  beforeEach(() => {
    mockDbSelectQueue.length = 0;
    mockInsertValuesSpy.mockClear();
    mockSaveCopiedRestaurantSpot.mockReset();
  });

  it("denies access when viewer does not have a library_shares row", async () => {
    mockDbSelectQueue.push([]);
    const detail = await getSharedLibraryGuideDetail("stranger-1", "owner-1");
    expect(detail).toBeNull();
  });

  it("returns sanitized spots without owner private status, ratingHalf, or notes", async () => {
    mockDbSelectQueue.push([{ createdAt: new Date("2026-11-15T10:00:00.000Z") }]);
    mockDbSelectQueue.push([{ id: "owner-1", name: "Alice", username: "alice" }]);
    mockDbSelectQueue.push([
      {
        id: "rest-owner-1",
        placeId: "place-1",
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
        createdAt: new Date("2026-11-10T00:00:00.000Z"),
      },
    ]);
    mockDbSelectQueue.push([{ id: "viewer-rest-1", placeId: "place-1" }]);

    const detail = await getSharedLibraryGuideDetail("partner-1", "owner-1");
    expect(detail).not.toBeNull();
    expect(detail?.guide.ownerName).toBe("Alice");
    expect(detail?.items).toHaveLength(1);

    const item = detail!.items[0]! as unknown as Record<string, unknown>;
    expect(item.name).toBe("Hangawi");
    expect(item.savedByViewer).toBe(true);
    expect(item.viewerRestaurantId).toBe("viewer-rest-1");
    expect("status" in item).toBe(false);
    expect("ratingHalf" in item).toBe(false);
    expect("notes" in item).toBe(false);
    expect("visitCount" in item).toBe(false);
    expect("lastVisitedOn" in item).toBe(false);
  });

  it("prevents self-sharing and invites valid partner username cleanly", async () => {
    mockDbSelectQueue.push([{ id: "owner-1", name: "Alice", username: "alice" }]);
    const selfRes = await inviteLibraryViewer("owner-1", "@alice");
    expect(selfRes).toEqual({ status: "self" });

    mockDbSelectQueue.push([{ id: "partner-1", name: "Bob", username: "bob" }]);
    mockDbSelectQueue.push([{ createdAt: new Date("2026-11-15T12:00:00.000Z") }]);
    const okRes = await inviteLibraryViewer("owner-1", "@bob");
    expect(okRes).toMatchObject({
      status: "ok",
      viewer: { userId: "partner-1", username: "bob" },
    });
    expect(mockInsertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "owner-1", viewerId: "partner-1" }),
    );
  });

  it("accepts invite link token and delegates saving spot cleanly", async () => {
    mockDbSelectQueue.push([{ ownerId: "owner-1", ownerName: "Alice", ownerUsername: "alice" }]);
    const accepted = await acceptLibraryInviteToken("partner-1", "tok_1234567890abcd");
    expect(accepted).toEqual({
      status: "ok",
      ownerId: "owner-1",
      ownerName: "Alice",
      ownerUsername: "alice",
    });

    mockDbSelectQueue.push([{ ownerId: "owner-1" }]);
    mockDbSelectQueue.push([
      {
        placeId: "place-1",
        name: "Hangawi",
        address: "12 E 32nd St",
        city: "New York",
        countryCode: "US",
        cuisines: ["Korean"],
        priceLevel: 3,
      },
    ]);
    mockSaveCopiedRestaurantSpot.mockResolvedValueOnce({
      created: true,
      restaurant: { id: "new-viewer-rest" },
    });

    const saved = await saveSpotFromSharedLibrary("partner-1", "owner-1", "rest-owner-1");
    expect(saved?.created).toBe(true);
    expect(mockSaveCopiedRestaurantSpot).toHaveBeenCalledWith(
      "partner-1",
      expect.objectContaining({ placeId: "place-1", name: "Hangawi" }),
    );
  });
});
