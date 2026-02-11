import { FileDropdown } from "./FileDropdown";
import { EditDropdown } from "./EditDropdown";
import { Logo } from "./Logo";
import { useCallback } from "react";
import { ExportType } from "@/modeling/export/model-exporter";

interface ProjectHeaderProps {
  onExport: (format: ExportType) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function ProjectHeader({
  onExport,
  onUndo,
  onRedo,
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
          <div className="flex items-center gap-4 pl-2">
            <Logo />
            <div className="flex items-center">
              <FileDropdown
                onExport={handleExport}
              />
              {onUndo && onRedo && (
                <EditDropdown onUndo={onUndo} onRedo={onRedo} />
              )}
            </div>
          </div>
        </div>
      </nav>

    </>
  );
}
