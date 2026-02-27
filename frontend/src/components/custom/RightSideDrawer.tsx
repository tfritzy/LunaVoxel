import { ObjectsSection } from "./objects/ObjectsSection";
import { ToolOptionsPanel } from "./ToolOptionsPanel";
import { RenderPanel } from "./RenderPanel";
import type { ToolOption } from "@/modeling/lib/tool-interface";
import type { RenderSettings } from "@/modeling/lib/webgpu-ray-tracer";

interface RightSideDrawerProps {
  projectId: string;
  toolOptions: ToolOption[];
  onToolOptionChange: (name: string, value: string) => void;
  rayTracingEnabled?: boolean;
  onRayTracingToggle?: (enabled: boolean) => void;
  renderSettings?: RenderSettings;
  onRenderSettingsChange?: (settings: RenderSettings) => void;
}

export const RightSideDrawer = ({
  projectId,
  toolOptions,
  onToolOptionChange,
  rayTracingEnabled,
  onRayTracingToggle,
  renderSettings,
  onRenderSettingsChange,
}: RightSideDrawerProps) => {
  return (
    <div className="h-full bg-background border-l border-border overflow-y-auto w-56 flex flex-col">
      <div className="flex-1">
        <ObjectsSection projectId={projectId} />
      </div>
      <ToolOptionsPanel
        options={toolOptions}
        onOptionChange={onToolOptionChange}
      />
      {onRayTracingToggle && renderSettings && onRenderSettingsChange && (
        <RenderPanel
          enabled={rayTracingEnabled ?? false}
          onToggle={onRayTracingToggle}
          settings={renderSettings}
          onSettingsChange={onRenderSettingsChange}
        />
      )}
    </div>
  );
};
