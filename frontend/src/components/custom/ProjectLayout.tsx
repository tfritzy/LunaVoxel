import { ProjectHeader } from "./ProjectHeader";
import { RightSideDrawer } from "./RightSideDrawer";
import { FloatingToolbar } from "./FloatingToolbar";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "@/modeling/lib/tool-type";
import { ExportType } from "@/modeling/export/model-exporter";
import { BlockDrawer } from "./blocks/BlockDrawer";
import { Texture } from "three";

interface AtlasData {
  blockAtlasMappings: number[][];
  texture: Texture | null;
  colors: number[];
}

interface ProjectLayoutProps {
  projectId: string;
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  currentTool: ToolType;
  currentMode: BlockModificationMode;
  onToolChange: (tool: ToolType) => void;
  onModeChange: (mode: BlockModificationMode) => void;
  onExport: (format: ExportType) => void;
  onSelectLayer?: (layerIndex: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  children: React.ReactNode;
  atlasData: AtlasData;
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
  onSelectLayer,
  onUndo,
  onRedo,
  children,
  atlasData,
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
          projectId={projectId}
          selectedBlock={selectedBlock}
          setSelectedBlock={setSelectedBlock}
          atlasData={atlasData}
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

        <RightSideDrawer onSelectLayer={onSelectLayer} projectId={projectId} />
      </div>
    </div>
  );
};
