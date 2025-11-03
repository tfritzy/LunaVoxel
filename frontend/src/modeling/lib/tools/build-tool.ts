import { ToolType } from "../../../module_bindings";
import { RectTool } from "./rect-tool";

export class RectSelectionTool extends RectTool {
  getType(): ToolType {
    return { tag: "Build" };
  }
}

