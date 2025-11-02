import type { ToolType } from "../../../module_bindings";
import type { Tool } from "../tool-interface";
import { BuildTool } from "./build-tool";
import { EraseTool } from "./erase-tool";
import { PaintTool } from "./paint-tool";
import { BlockPickerTool } from "./block-picker-tool";
import { MagicSelectTool } from "./magic-select-tool";

export { BuildTool } from "./build-tool";
export { EraseTool } from "./erase-tool";
export { PaintTool } from "./paint-tool";
export { BlockPickerTool } from "./block-picker-tool";
export { MagicSelectTool } from "./magic-select-tool";

/**
 * Factory function to create a tool instance based on ToolType
 */
export function createTool(toolType: ToolType): Tool {
  switch (toolType.tag) {
    case "Build":
      return new BuildTool();
    case "Erase":
      return new EraseTool();
    case "Paint":
      return new PaintTool();
    case "BlockPicker":
      return new BlockPickerTool();
    case "MagicSelect":
      return new MagicSelectTool();
    default:
      throw new Error(`Unknown tool type: ${JSON.stringify(toolType)}`);
  }
}
