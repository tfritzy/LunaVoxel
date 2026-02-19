import { describe, expect, it } from "vitest";
import { colorPalettes } from "./colorPalettes";

describe("colorPalettes", () => {
  it("orders each palette with brighter colors first by reversing source order", () => {
    const resurrect = colorPalettes.find(
      (palette) => palette.name === "Resurrect 64"
    );
    const pico8 = colorPalettes.find((palette) => palette.name === "PICO-8");

    expect(resurrect?.colors[0]).toBe(0x571c27);
    expect(resurrect?.colors[resurrect.colors.length - 1]).toBe(0x2e222f);
    expect(pico8?.colors[0]).toBe(0xffccaa);
    expect(pico8?.colors[pico8.colors.length - 1]).toBe(0x000000);
  });
});
