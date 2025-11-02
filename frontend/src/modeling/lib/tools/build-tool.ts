import { ToolType } from "../../../module_bindings";
import { RectTool } from "./rect-tool";

export class BuildTool extends RectTool {
  getType(): ToolType {
    return { tag: "Build" };
  }

  protected getNormalMultiplier(): number {
    // Build tool places blocks in the direction of the normal
    return 0.1;
  }
}
