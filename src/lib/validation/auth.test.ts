import { describe, expect, it } from "vitest";

import {
  buildPlaceholderEmail,
  joinSchema,
  normalizeUsername,
  signInSchema,
  suggestUsernameFromName,
} from "./auth";

describe("auth validation", () => {
  it("normalizes usernames to trimmed lowercase and builds .invalid placeholder emails", () => {
    expect(normalizeUsername("  Maya_Lin ")).toBe("maya_lin");
    expect(buildPlaceholderEmail("Maya_Lin")).toBe("maya_lin@users.invalid");
  });

  it("suggests valid usernames from display names", () => {
    expect(suggestUsernameFromName("Maya Lin")).toBe("maya_lin");
    expect(suggestUsernameFromName("Al")).toBe("al_foodie");
    expect(suggestUsernameFromName("   ")).toBe("");
  });

  it("accepts valid join inputs and rejects invalid usernames or short passwords", () => {
    expect(
      joinSchema.safeParse({
        name: "Maya Lin",
        username: "maya_lin",
        password: "password123",
      }).success,
    ).toBe(true);

    expect(
      joinSchema.safeParse({
        name: "Maya",
        username: "ab",
        password: "password123",
      }).success,
    ).toBe(false);

    expect(
      joinSchema.safeParse({
        name: "Maya",
        username: "maya-lin",
        password: "password123",
      }).success,
    ).toBe(false);

    expect(
      joinSchema.safeParse({
        name: "Maya",
        username: "maya_lin",
        password: "short",
      }).success,
    ).toBe(false);
  });

  it("validates sign-in inputs", () => {
    expect(signInSchema.safeParse({ username: "maya_lin", password: "secret" }).success).toBe(true);
    expect(signInSchema.safeParse({ username: "x", password: "secret" }).success).toBe(false);
  });
});
