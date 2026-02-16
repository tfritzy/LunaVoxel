import { ProjectHeader } from "./ProjectHeader";
import { RightSideDrawer } from "./RightSideDrawer";
import { FloatingToolbar } from "./FloatingToolbar";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { ToolOption } from "@/modeling/lib/tool-interface";
import { ExportType } from "@/modeling/export/model-exporter";
import { BlockDrawer } from "./blocks/BlockDrawer";

interface ProjectLayoutProps {
  projectId: string;
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  currentTool: ToolType;
  currentMode: BlockModificationMode;
  onToolChange: (tool: ToolType) => void;
  onModeChange: (mode: BlockModificationMode) => void;
  onExport: (format: ExportType) => void;
  onSelectObject?: (objectIndex: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  children: React.ReactNode;
  toolOptions: ToolOption[];
  onToolOptionChange: (name: string, value: string) => void;
}

export const ProjectLayout = ({
  projectId,
  selectedBlock,
  setSelectedBlock,
  currentTool,
  currentMode,
  onToolChange,
  onModeChange,
  onExport,
  onSelectObject,
  onUndo,
  onRedo,
  children,
  toolOptions,
  onToolOptionChange,
}: ProjectLayoutProps) => {
  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <ProjectHeader
        onExport={onExport}
        onUndo={onUndo}
        onRedo={onRedo}
      />

      <div className="flex flex-1 min-h-0">
        <BlockDrawer
          selectedBlock={selectedBlock}
          setSelectedBlock={setSelectedBlock}
        />

        <div className="flex-1 relative bg-muted/5 min-w-0">
          {children}
          <FloatingToolbar
            currentTool={currentTool}
            currentMode={currentMode}
            onToolChange={onToolChange}
            onModeChange={onModeChange}
          />
        </div>

        <RightSideDrawer
          onSelectObject={onSelectObject}
          projectId={projectId}
          toolOptions={toolOptions}
          onToolOptionChange={onToolOptionChange}
        />
      </div>
    </div>
  );
};
