import { ProjectHeader } from "./ProjectHeader";
import { RightSideDrawer } from "./RightSideDrawer";
import { FloatingToolbar } from "./FloatingToolbar";
import { BlockModificationMode } from "@/module_bindings";
import { ExportType } from "@/modeling/export/model-exporter";
import { BlockDrawer } from "./blocks/BlockDrawer";

interface ProjectLayoutProps {
    projectId: string;
    selectedBlock: number;
    setSelectedBlock: (index: number) => void;
    currentTool: BlockModificationMode;
    onToolChange: (tool: BlockModificationMode) => void;
    onExport: (format: ExportType) => void;
    onSelectLayer?: (layerIndex: number) => void;
    children: React.ReactNode;
}

export const ProjectLayout = ({
    projectId,
    selectedBlock,
    setSelectedBlock,
    currentTool,
    onToolChange,
    onExport,
    onSelectLayer,
    children,
}: ProjectLayoutProps) => {
    return (
        <div className="h-screen w-screen flex flex-col bg-background">
            <ProjectHeader onExport={onExport} />

            <div className="flex flex-1 min-h-0">
                <BlockDrawer
                    projectId={projectId}
                    selectedBlock={selectedBlock}
                    setSelectedBlock={setSelectedBlock}
                />

                <div className="flex-1 relative bg-muted/5 min-w-0">
                    {children}
                    <FloatingToolbar
                        currentTool={currentTool}
                        onToolChange={onToolChange}
                    />
                </div>

                <RightSideDrawer
                    onSelectLayer={onSelectLayer}
                    projectId={projectId}
                />
            </div>
        </div>
    );
};