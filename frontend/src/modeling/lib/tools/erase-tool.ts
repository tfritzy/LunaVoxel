import { ToolType } from "../../../module_bindings";
import { RectTool } from "./rect-tool";

export class EraseTool extends RectTool {
  getType(): ToolType {
    return { tag: "Erase" };
  }

  protected getNormalMultiplier(): number {
    return -0.1;
  }
}
