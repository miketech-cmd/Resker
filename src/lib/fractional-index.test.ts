import { describe, expect, it } from "vitest";

import {
  generateKeyBetween,
  generateNKeysBetween,
  isValidPositionKey,
} from "@/lib/fractional-index";

describe("fractional-index", () => {
  it("generates a default key when both bounds are null", () => {
    const first = generateKeyBetween(null, null);
    expect(first).toBe("a0");
    expect(isValidPositionKey(first)).toBe(true);
  });

  it("maintains strict lexicographical order across 200 sequential appends", () => {
    const keys: string[] = [];
    let prev: string | null = null;
    for (let i = 0; i < 200; i++) {
      const next = generateKeyBetween(prev, null);
      if (prev !== null) {
        expect(prev < next).toBe(true);
      }
      keys.push(next);
      prev = next;
    }
    expect(keys.every(isValidPositionKey)).toBe(true);
  });

  it("maintains strict order across 100 prepends before the first item", () => {
    let head = generateKeyBetween(null, null);
    for (let i = 0; i < 100; i++) {
      const before = generateKeyBetween(null, head);
      expect(before < head).toBe(true);
      expect(isValidPositionKey(before)).toBe(true);
      head = before;
    }
  });

  it("inserts repeatedly between two adjacent keys without collision", () => {
    let left = "a0";
    const right = "a1";
    for (let i = 0; i < 50; i++) {
      const mid = generateKeyBetween(left, right);
      expect(left < mid).toBe(true);
      expect(mid < right).toBe(true);
      expect(isValidPositionKey(mid)).toBe(true);
      left = mid;
    }
  });

  it("generates N ordered keys cleanly", () => {
    const keys = generateNKeysBetween("a0", "b0", 5);
    expect(keys).toHaveLength(5);
    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i]! < keys[i + 1]!).toBe(true);
    }
    expect("a0" < keys[0]!).toBe(true);
    expect(keys[keys.length - 1]! < "b0").toBe(true);
  });
});
