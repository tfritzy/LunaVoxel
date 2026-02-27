import { FileDropdown } from "./FileDropdown";
import { EditDropdown } from "./EditDropdown";
import { useCallback } from "react";
import { ExportType } from "@/modeling/export/model-exporter";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface ProjectHeaderProps {
  onExport: (format: ExportType) => void;
  onUndo: () => void;
  onRedo: () => void;
  rayTracingEnabled?: boolean;
  onRayTracingToggle?: (enabled: boolean) => void;
}

export function ProjectHeader({
  onExport,
  onUndo,
  onRedo,
  rayTracingEnabled,
  onRayTracingToggle,
}: ProjectHeaderProps) {
  const handleExport = useCallback(
    (type: ExportType) => {
      onExport(type);
    },
    [onExport]
  );

  return (
    <>
      <nav className="h-14 w-full bg-background border-b border-border relative z-10">
        <div className="w-full h-full flex items-center px-4">
          <div className="flex items-center">
            <FileDropdown
              onExport={handleExport}
            />
            {onUndo && onRedo && (
              <EditDropdown onUndo={onUndo} onRedo={onRedo} />
            )}
          </div>
          {onRayTracingToggle && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant={rayTracingEnabled ? "default" : "ghost"}
                size="sm"
                className="h-6 gap-1.5 text-xs"
                onClick={() => onRayTracingToggle(!rayTracingEnabled)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ray Trace
              </Button>
            </div>
          )}
        </div>
      </nav>

    </>
  );
}
