import { ToolType } from "../../../module_bindings";
import { RectTool } from "./rect-tool";

export class PaintTool extends RectTool {
  getType(): ToolType {
    return { tag: "Paint" };
  }

  protected getNormalMultiplier(): number {
    // Paint tool targets existing blocks, so we go against the normal
    return -0.1;
  }
}
