import { describe, expect, it } from "vitest";
import { normalizeSelectedObjectIndex } from "../builder";

describe("normalizeSelectedObjectIndex", () => {
  it("clamps selection to an existing object index", () => {
    expect(normalizeSelectedObjectIndex(-1, 3)).toBe(0);
    expect(normalizeSelectedObjectIndex(1, 3)).toBe(1);
    expect(normalizeSelectedObjectIndex(9, 3)).toBe(2);
  });

  it("returns zero when there are no objects", () => {
    expect(normalizeSelectedObjectIndex(3, 0)).toBe(0);
  });
});
