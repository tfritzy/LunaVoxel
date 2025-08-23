import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { FloatingToolbar } from "@/components/custom/FloatingToolbar";
import {
  BlockModificationMode,
  DbConnection,
  Project,
} from "@/module_bindings";
import { ProjectHeader } from "@/components/custom/ProjectHeader";
import { BlockDrawer } from "@/components/custom/blocks/BlockDrawer";
import { RightSideDrawer } from "@/components/custom/RightSideDrawer";
import { useCustomCursor } from "@/lib/useCustomCursor";
import { CameraStatePersistence } from "@/modeling/lib/camera-controller-persistence";
import { useQueryRunner } from "@/lib/useQueryRunner";

export const ProjectViewPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const getTable = useCallback((db: DbConnection) => db.db.projects, []);
  const { data: projects } = useQueryRunner(
    connection,
    `SELECT * FROM projects WHERE Id='${projectId}'`,
    getTable
  );
  const project = projects[0] as Project | null;
  console.log(project);
  const customCursor = useCustomCursor(currentTool);

  const handleLayerSelect = useCallback((layerIndex: number) => {
    engineRef.current?.projectManager?.builder.setSelectedLayer(layerIndex);
  }, []);

  const handleExportOBJ = useCallback(() => {
    if (engineRef.current?.projectManager) {
      engineRef.current.projectManager.exportToOBJ();
    }
  }, []);

  useEffect(() => {
    engineRef.current?.projectManager?.setSelectedBlock(selectedBlock);
  }, [selectedBlock]);

  useEffect(() => {
    if (!projectId || !connection) return;

    return () => {
      if (engineRef.current) {
        if (projectId) {
          const cameraState = engineRef.current.getCameraState();
          CameraStatePersistence.save(projectId, cameraState);
        }
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [projectId, connection]);

  useEffect(() => {
    if (!connection || !project || !projectId) return;

    if (engineRef.current) {
      if (projectId) {
        const cameraState = engineRef.current.getCameraState();
        CameraStatePersistence.save(projectId, cameraState);
      }
      engineRef.current.dispose();
      engineRef.current = null;
    }

    const savedCameraState = CameraStatePersistence.load(projectId);

    engineRef.current = new VoxelEngine({
      container: containerRef.current!,
      connection,
      project,
      initialCameraState: savedCameraState || undefined,
    });

    engineRef.current.projectManager.setSelectedBlock(selectedBlock);
    engineRef.current.projectManager.setTool(currentTool);

    return () => {
      if (engineRef.current && projectId) {
        const cameraState = engineRef.current.getCameraState();
        CameraStatePersistence.save(projectId, cameraState);
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, project]);

  useEffect(() => {
    if (!engineRef.current || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (engineRef.current) {
        engineRef.current.handleContainerResize();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.projectManager.setTool(currentTool);
    }
  }, [currentTool]);

  const handleToolChange = (tool: BlockModificationMode) => {
    setCurrentTool(tool);
  };

  return (
    <div>
      <ProjectHeader onExportOBJ={handleExportOBJ} />
      <div className="h-full flex">
        <div className="flex-1 relative">
          <BlockDrawer
            projectId={projectId || ""}
            selectedBlock={selectedBlock}
            setSelectedBlock={setSelectedBlock}
          />

          <div
            ref={containerRef}
            className="h-full"
            style={{ height: "calc(100vh - 64px)", cursor: customCursor }}
          />

          <FloatingToolbar
            currentTool={currentTool}
            onToolChange={handleToolChange}
          />

          <RightSideDrawer
            projectId={projectId || ""}
            onSelectLayer={handleLayerSelect}
          />
        </div>
      </div>
    </div>
  );
};
