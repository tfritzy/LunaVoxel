import { FileDropdown } from "./FileDropdown";
import { EditDropdown } from "./EditDropdown";
import { useCallback } from "react";
import { ExportType } from "@/modeling/export/model-exporter";
import { Pencil, Sun } from "lucide-react";

export type ViewMode = "model" | "render";

interface ProjectHeaderProps {
  onExport: (format: ExportType) => void;
  onUndo: () => void;
  onRedo: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  renderTabVisible?: boolean;
}

export function ProjectHeader({
  onExport,
  onUndo,
  onRedo,
  viewMode,
  onViewModeChange,
  renderTabVisible,
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
          <div className="flex items-center ml-6 gap-1">
            <button
              onClick={() => onViewModeChange("model")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "model"
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Model
            </button>
            {renderTabVisible && (
              <button
                onClick={() => onViewModeChange("render")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === "render"
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Render
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
