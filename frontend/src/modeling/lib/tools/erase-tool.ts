import { ToolType } from "../../../module_bindings";
import { RectTool } from "./rect-tool";

export class EraseTool extends RectTool {
  getType(): ToolType {
    return { tag: "Erase" };
  }

  protected getNormalMultiplier(): number {
    // Erase tool targets existing blocks, so we go against the normal
    return -0.1;
  }
}
