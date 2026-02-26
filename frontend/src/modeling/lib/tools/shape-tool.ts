import type { ToolType } from "../tool-type";
import type { FillShape, ShapeDirection } from "../tool-type";
import type { ToolOption } from "../tool-interface";
import { RectTool } from "./rect-tool";

export class ShapeTool extends RectTool {
  constructor() {
    super();
    this.fillShape = "Sphere";
  }

  getType(): ToolType {
    return "Shape";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Fill Shape",
        values: ["Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon"],
        currentValue: this.fillShape,
      },
      {
        name: "Up Direction",
        values: ["+x", "-x", "+y", "-y", "+z", "-z"],
        currentValue: this.direction,
        type: "direction",
      },
      {
        name: "Adjust Before Apply",
        values: ["true", "false"],
        currentValue: this.adjustBeforeApply ? "true" : "false",
        type: "checkbox",
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Fill Shape") {
      this.fillShape = value as FillShape;
      if (this.pending) {
        this.pending.fillShape = this.fillShape;
      }
    } else if (name === "Up Direction") {
      this.direction = value as ShapeDirection;
      if (this.pending) {
        this.pending.direction = this.direction;
      }
    } else if (name === "Adjust Before Apply") {
      this.adjustBeforeApply = value === "true";
    }
  }
}
