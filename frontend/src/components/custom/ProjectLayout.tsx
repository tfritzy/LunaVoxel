import { ProjectHeader } from "./ProjectHeader";
import type { ViewMode } from "./ProjectHeader";
import { RightSideDrawer } from "./RightSideDrawer";
import { RenderPanel } from "./RenderPanel";
import { FloatingToolbar } from "./FloatingToolbar";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { ToolOption } from "@/modeling/lib/tool-interface";
import { ExportType } from "@/modeling/export/model-exporter";
import { BlockDrawer } from "./blocks/BlockDrawer";
import type { RenderSettings } from "@/modeling/lib/webgpu-ray-tracer";

interface ProjectLayoutProps {
  projectId: string;
  selectedBlock: number;
  setSelectedBlock: (index: number) => void;
  currentTool: ToolType;
  currentMode: BlockModificationMode;
  onToolChange: (tool: ToolType) => void;
  onModeChange: (mode: BlockModificationMode) => void;
  onExport: (format: ExportType) => void;
  onUndo: () => void;
  onRedo: () => void;
  children: React.ReactNode;
  toolOptions: ToolOption[];
  onToolOptionChange: (name: string, value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  renderTabVisible?: boolean;
  renderSettings?: RenderSettings;
  onRenderSettingsChange?: (settings: RenderSettings) => void;
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
  onUndo,
  onRedo,
  children,
  toolOptions,
  onToolOptionChange,
  viewMode,
  onViewModeChange,
  renderTabVisible,
  renderSettings,
  onRenderSettingsChange,
}: ProjectLayoutProps) => {
  const isRenderMode = viewMode === "render";

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <ProjectHeader
        onExport={onExport}
        onUndo={onUndo}
        onRedo={onRedo}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        renderTabVisible={renderTabVisible}
      />

      <div className="flex flex-1 min-h-0">
        {!isRenderMode && (
          <BlockDrawer
            selectedBlock={selectedBlock}
            setSelectedBlock={setSelectedBlock}
          />
        )}

        <div className="flex-1 relative bg-muted/5 min-w-0">
          {children}
          {!isRenderMode && (
            <FloatingToolbar
              currentTool={currentTool}
              currentMode={currentMode}
              onToolChange={onToolChange}
              onModeChange={onModeChange}
              toolOptions={toolOptions}
            />
          )}
        </div>

        {isRenderMode && renderSettings && onRenderSettingsChange ? (
          <RenderPanel
            settings={renderSettings}
            onSettingsChange={onRenderSettingsChange}
          />
        ) : (
          <RightSideDrawer
            projectId={projectId}
            toolOptions={toolOptions}
            onToolOptionChange={onToolOptionChange}
          />
        )}
      </div>
    </div>
  );
};
