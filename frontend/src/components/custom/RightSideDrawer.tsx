import { ObjectsSection } from "./objects/ObjectsSection";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { ToolOptions } from "@/modeling/lib/tool-options";
import { ToolOptionsSection } from "./tools/ToolOptionsSection";

interface RightSideDrawerProps {
  onSelectObject?: (objectIndex: number) => void;
  projectId: string;
  currentTool: ToolType;
  toolOptions: ToolOptions;
  onToolOptionsChange: (toolOptions: ToolOptions) => void;
}

export const RightSideDrawer = ({
  onSelectObject,
  projectId,
  currentTool,
  toolOptions,
  onToolOptionsChange,
}: RightSideDrawerProps) => {
  return (
    <div className="h-full bg-background border-l border-border w-56 flex flex-col">
      <div className="overflow-y-auto flex-1">
        <ObjectsSection onSelectObject={onSelectObject} projectId={projectId} />
      </div>
      <ToolOptionsSection
        currentTool={currentTool}
        toolOptions={toolOptions}
        onToolOptionsChange={onToolOptionsChange}
      />
    </div>
  );
};
