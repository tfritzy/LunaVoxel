import type { ToolType } from "../../../module_bindings";
import type { Tool } from "../tool-interface";
import { RectTool } from "./rect-tool";
import { BlockPickerTool } from "./block-picker-tool";
import { MagicSelectTool } from "./magic-select-tool";

export { RectTool } from "./rect-tool";
export { BlockPickerTool } from "./block-picker-tool";
export { MagicSelectTool } from "./magic-select-tool";

export function createTool(toolType: ToolType): Tool {
  switch (toolType.tag) {
    case "Build":
    case "Erase":
    case "Paint":
      return new RectTool();
    case "BlockPicker":
      return new BlockPickerTool();
    case "MagicSelect":
      return new MagicSelectTool();
    default:
      throw new Error(
        `Unknown tool type: ${JSON.stringify(toolType)}`
      );
  }
}
