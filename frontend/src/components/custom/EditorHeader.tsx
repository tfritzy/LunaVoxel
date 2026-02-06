import { FileDropdown } from "./FileDropdown";
import { EditDropdown } from "./EditDropdown";
import { Logo } from "./Logo";
import { ExportType } from "@/modeling/export/model-exporter";

interface EditorHeaderProps {
  onExport: (format: ExportType) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function EditorHeader({
  onExport,
  onUndo,
  onRedo,
}: EditorHeaderProps) {
  return (
    <nav className="h-18 w-full bg-background border-b border-border relative z-10">
      <div className="w-full h-full py-2 flex justify-between items-center px-4">
        <div className="flex items-center gap-4 pl-2">
          <Logo />
          <div className="-translate-x-2">
            <div className="text-lg font-medium text-foreground">
              LunaVoxel
            </div>
            <div className="flex items-center">
              <FileDropdown onExport={onExport} />
              <EditDropdown onUndo={onUndo} onRedo={onRedo} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
