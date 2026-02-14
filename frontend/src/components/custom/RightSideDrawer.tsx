import { ObjectsSection } from "./objects/ObjectsSection";
import { ToolOptionsPanel } from "./ToolOptionsPanel";
import type { ToolOption } from "@/modeling/lib/tool-interface";

interface RightSideDrawerProps {
  onSelectObject?: (objectIndex: number) => void;
  projectId: string;
  toolOptions: ToolOption[];
  onToolOptionChange: (name: string, value: string) => void;
}

export const RightSideDrawer = ({
  onSelectObject,
  projectId,
  toolOptions,
  onToolOptionChange,
}: RightSideDrawerProps) => {
  return (
    <div className="h-full bg-background border-l border-border overflow-y-auto w-56">
      <div className="">
        <ObjectsSection onSelectObject={onSelectObject} projectId={projectId} />
      </div>
      <ToolOptionsPanel
        options={toolOptions}
        onOptionChange={onToolOptionChange}
      />
    </div>
  );
};
