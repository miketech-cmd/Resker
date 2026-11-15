import { describe, expect, it } from "vitest";

import {
  clonePublicListSchema,
  createListSchema,
  inviteListMemberSchema,
  listItemActionSchema,
  publicListsFilterSchema,
  reorderListItemSchema,
  savePublicSpotSchema,
  updateListMemberRoleSchema,
  updateListSchema,
} from "@/lib/validation/lists";

describe("list validation schemas", () => {
  it("validates list creation with icon, public flag, and city", () => {
    const parsed = createListSchema.safeParse({
      name: "  NY 2026 Travel  ",
      description: "Late night ramen & pizza",
      icon: "noodles",
      isPublic: true,
      city: "  New York  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("NY 2026 Travel");
      expect(parsed.data.icon).toBe("noodles");
      expect(parsed.data.isPublic).toBe(true);
      expect(parsed.data.city).toBe("New York");
    }
  });

  it("validates public save-spot, clone, and browse filters", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(savePublicSpotSchema.safeParse({ sourceRestaurantId: id }).success).toBe(true);
    expect(savePublicSpotSchema.safeParse({ sourceRestaurantId: "not-a-uuid" }).success).toBe(
      false,
    );
    expect(clonePublicListSchema.safeParse({ name: "My Seattle Veg List" }).success).toBe(true);
    expect(clonePublicListSchema.safeParse({ name: "" }).success).toBe(false);
    expect(publicListsFilterSchema.safeParse({ q: "ramen", city: "Seattle" }).success).toBe(true);
  });

  it("rejects unknown icons or empty updates", () => {
    expect(createListSchema.safeParse({ name: "Date Night", icon: "rocket" }).success).toBe(false);
    expect(updateListSchema.safeParse({}).success).toBe(false);
  });

  it("validates item add and reorder inputs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(listItemActionSchema.safeParse({ userRestaurantId: id }).success).toBe(true);
    expect(listItemActionSchema.safeParse({ userRestaurantId: "bad" }).success).toBe(false);

    expect(
      reorderListItemSchema.safeParse({
        userRestaurantId: id,
        afterItemId: null,
        beforeItemId: id,
        position: "a0V",
      }).success,
    ).toBe(true);
  });

  it("validates Phase 8 share slug actions and collaborator invite/role schemas", () => {
    expect(updateListSchema.safeParse({ regenerateSlug: true }).success).toBe(true);
    expect(updateListSchema.safeParse({ revokeSlug: true }).success).toBe(true);

    const inviteParsed = inviteListMemberSchema.safeParse({
      username: "  @Alice_Chef ",
      role: "viewer",
    });
    expect(inviteParsed.success).toBe(true);
    if (inviteParsed.success) {
      expect(inviteParsed.data.username).toBe("alice_chef");
      expect(inviteParsed.data.role).toBe("viewer");
    }

    const defaultRoleInvite = inviteListMemberSchema.safeParse({ username: "bob" });
    expect(defaultRoleInvite.success).toBe(true);
    if (defaultRoleInvite.success) {
      expect(defaultRoleInvite.data.role).toBe("editor");
    }

    expect(inviteListMemberSchema.safeParse({ username: "x" }).success).toBe(false);
    expect(updateListMemberRoleSchema.safeParse({ role: "editor" }).success).toBe(true);
    expect(updateListMemberRoleSchema.safeParse({ role: "owner" }).success).toBe(false);
  });
});
