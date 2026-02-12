import { describe, it, expect } from "vitest";
import { normalizeHex } from "../color-utils";

describe("normalizeHex", () => {
  it("normalizes 3-digit hex codes", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  it("normalizes 6-digit hex codes", () => {
    expect(normalizeHex("#a1b2c3")).toBe("#a1b2c3");
  });

  it("accepts hex codes without a leading #", () => {
    expect(normalizeHex("fff")).toBe("#ffffff");
  });

  it("returns null for invalid values", () => {
    expect(normalizeHex("#abcd")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});
