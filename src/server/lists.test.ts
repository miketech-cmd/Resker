import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockLimitQueue: Array<unknown[]> = [];
const mockUpdateSetSpy = vi.fn();

function makeWhereChain() {
  let consumed = false;
  const take = () => {
    consumed = true;
    return mockLimitQueue.shift() ?? [];
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
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mockUpdateSetSpy(values);
        return {
          where: () => ({
            returning: async () => [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                userId: "owner-1",
                name: "Shared Eats",
                description: null,
                icon: "bowl",
                publicSlug: values.publicSlug ?? null,
                isPublic: values.isPublic ?? false,
                isFeatured: false,
                city: null,
                copyCount: 0,
                sourceListId: null,
                createdAt: new Date("2026-11-15T00:00:00.000Z"),
                updatedAt: new Date("2026-11-15T00:00:00.000Z"),
              },
            ],
          }),
        };
      },
    }),
  },
}));

import {
  canEditList,
  canManageList,
  canReadList,
  getListAccessRole,
  updateUserList,
} from "@/server/lists";

describe("Phase 8 list authorization & share slug helpers", () => {
  beforeEach(() => {
    mockLimitQueue.length = 0;
    mockUpdateSetSpy.mockClear();
  });

  it("grants owner full read, edit, and manage permissions", async () => {
    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }]);
    const access = await getListAccessRole("owner-1", "list-1");
    expect(access?.role).toBe("owner");

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }]);
    expect(await canReadList("owner-1", "list-1")).toBe(true);

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }]);
    expect(await canEditList("owner-1", "list-1")).toBe(true);

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }]);
    expect(await canManageList("owner-1", "list-1")).toBe(true);
  });

  it("grants editor read + edit access, but denies owner management", async () => {
    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "editor" }]);
    const access = await getListAccessRole("editor-1", "list-1");
    expect(access?.role).toBe("editor");

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "editor" }]);
    expect(await canEditList("editor-1", "list-1")).toBe(true);

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "editor" }]);
    expect(await canManageList("editor-1", "list-1")).toBe(false);
  });

  it("grants viewer read-only access and denies edit & manage", async () => {
    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "viewer" }]);
    const access = await getListAccessRole("viewer-1", "list-1");
    expect(access?.role).toBe("viewer");

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "viewer" }]);
    expect(await canReadList("viewer-1", "list-1")).toBe(true);

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "viewer" }]);
    expect(await canEditList("viewer-1", "list-1")).toBe(false);

    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], [{ role: "viewer" }]);
    expect(await canManageList("viewer-1", "list-1")).toBe(false);
  });

  it("returns null / false for users without membership", async () => {
    mockLimitQueue.push([{ id: "list-1", ownerId: "owner-1" }], []);
    expect(await getListAccessRole("stranger-1", "list-1")).toBeNull();

    mockLimitQueue.push([]);
    expect(await canReadList("owner-1", "missing-list")).toBe(false);
  });

  it("generates an unguessable 12-char slug when publishing or regenerating, and revokes it cleanly", async () => {
    // 1. Existing private list -> regenerateSlug creates 12-char base64url token
    mockLimitQueue.push([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        userId: "owner-1",
        publicSlug: "oldSlug12345",
        isPublic: true,
      },
    ]);
    mockLimitQueue.push([]); // no items needed for count map? listItems + listMembers queries
    mockLimitQueue.push([]);

    const regenerated = await updateUserList("owner-1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      regenerateSlug: true,
    });
    expect(regenerated).not.toBeNull();
    const regCall = mockUpdateSetSpy.mock.calls[0]?.[0] as {
      publicSlug?: string;
      isPublic?: boolean;
    };
    expect(regCall.isPublic).toBe(true);
    expect(regCall.publicSlug).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(regCall.publicSlug).not.toBe("oldSlug12345");

    // 2. revokeSlug clears publicSlug and sets isPublic false
    mockLimitQueue.push([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        userId: "owner-1",
        publicSlug: regCall.publicSlug,
        isPublic: true,
      },
    ]);
    mockLimitQueue.push([]);
    mockLimitQueue.push([]);

    await updateUserList("owner-1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      revokeSlug: true,
    });
    const revokeCall = mockUpdateSetSpy.mock.calls[1]?.[0] as {
      publicSlug?: string | null;
      isPublic?: boolean;
    };
    expect(revokeCall.isPublic).toBe(false);
    expect(revokeCall.publicSlug).toBeNull();
  });
});
