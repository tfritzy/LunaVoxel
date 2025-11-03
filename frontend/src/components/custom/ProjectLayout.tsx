import { ProjectHeader } from "./ProjectHeader";
import { RightSideDrawer } from "./RightSideDrawer";
import { FloatingToolbar } from "./FloatingToolbar";
import { AccessType } from "@/module_bindings";
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
  onToolChange: (tool: ToolType) => void;
  onExport: (format: ExportType) => void;
  onSelectLayer?: (layerIndex: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  children: React.ReactNode;
  atlasData: AtlasData;
  accessLevel: AccessType | null;
}

export const ProjectLayout = ({
  projectId,
  selectedBlock,
  setSelectedBlock,
  currentTool,
  onToolChange,
  onExport,
  onSelectLayer,
  onUndo,
  onRedo,
  children,
  atlasData,
  accessLevel,
}: ProjectLayoutProps) => {
  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <ProjectHeader
        onExport={onExport}
        onUndo={onUndo}
        onRedo={onRedo}
        accessLevel={accessLevel}
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
          {accessLevel?.tag === "ReadWrite" && (
            <FloatingToolbar
              currentTool={currentTool}
              onToolChange={onToolChange}
            />
          )}
        </div>

        <RightSideDrawer onSelectLayer={onSelectLayer} projectId={projectId} />
      </div>
    </div>
  );
};