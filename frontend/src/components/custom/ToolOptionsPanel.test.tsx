import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToolOptionsPanel } from "./ToolOptionsPanel";
import type { ToolOption } from "@/modeling/lib/tool-interface";

type RangeInputProps = {
  type?: string;
  className?: string;
  min?: number;
  max?: number;
  onChange: (event: { target: { value: string } }) => void;
  children?: ReactNode;
};

function findRangeInput(node: ReactNode): ReactElement<RangeInputProps> | null {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const input = findRangeInput(child);
      if (input) {
        return input;
      }
    }
    return null;
  }

  if (typeof node !== "object") {
    return null;
  }

  const element = node as ReactElement<RangeInputProps>;
  if (element.type === "input" && element.props.type === "range") {
    return element;
  }

  return findRangeInput(element.props.children);
}

describe("ToolOptionsPanel slider options", () => {
  it("renders slider options with expected range behavior", () => {
    const onOptionChange = vi.fn();
    const options: ToolOption[] = [
      {
        name: "Size",
        values: [],
        currentValue: "5",
        type: "slider",
        min: 1,
        max: 10,
      },
    ];

    const panel = ToolOptionsPanel({ options, onOptionChange });
    const slider = findRangeInput(panel);

    expect(slider).not.toBeNull();
    expect(slider?.props.className).toContain("tool-slider");
    expect(slider?.props.min).toBe(1);
    expect(slider?.props.max).toBe(10);

    slider?.props.onChange({ target: { value: "7" } });
    expect(onOptionChange).toHaveBeenCalledWith("Size", "7");
  });
});
