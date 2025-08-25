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
import { useAtlasContext } from "@/contexts/CurrentProjectContext";

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
  const { data: projects } = useQueryRunner(connection, getTable);
  const project = projects[0] as Project | null;
  const customCursor = useCustomCursor(currentTool);
  const [loading, setLoading] = useState<boolean>(true);
  const { atlas, textureAtlas } = useAtlasContext();

  const handleLayerSelect = useCallback((layerIndex: number) => {
    engineRef.current?.projectManager?.builder.setSelectedLayer(layerIndex);
  }, []);

  const handleExportOBJ = useCallback(() => {
    if (engineRef.current?.projectManager) {
      engineRef.current.projectManager.exportToOBJ();
    }
  }, []);

  useEffect(() => {
    if (!connection) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setLoading(false);
      })
      .onError((error) => {
        console.error("subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM projects WHERE Id='${projectId}'`,
        `SELECT * FROM project_blocks WHERE ProjectId='${projectId}'`,
        `SELECT * FROM layer WHERE ProjectId='${projectId}'`,
        `SELECT * FROM player_cursor WHERE ProjectId='${projectId}'`,
        `SELECT * FROM atlas WHERE ProjectId='${projectId}'`,
      ]);

    return () => {
      subscription.unsubscribe();
    };
  }, [connection, projectId]);

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

  const containerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !connection || !project || !projectId) return;
      if (engineRef.current) return;

      const savedCameraState = CameraStatePersistence.load(projectId);
      engineRef.current = new VoxelEngine({
        container: node,
        connection,
        project,
        initialCameraState: savedCameraState || undefined,
      });

      engineRef.current.projectManager.setSelectedBlock(selectedBlock);
      engineRef.current.projectManager.setTool(currentTool);
      engineRef.current.projectManager.setAtlas(atlas);
      engineRef.current.projectManager.setTextureAtlas(textureAtlas);
    },
    [
      connection,
      project,
      projectId,
      selectedBlock,
      currentTool,
      atlas,
      textureAtlas,
    ]
  );

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

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.projectManager.setAtlas(atlas);
    }
  }, [atlas]);

  useEffect(() => {
    if (engineRef.current && textureAtlas) {
      engineRef.current.projectManager.setTextureAtlas(textureAtlas);
    }
  }, [textureAtlas]);

  const handleToolChange = useCallback((tool: BlockModificationMode) => {
    setCurrentTool(tool);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-medium">
            {status === "poke-attempted"
              ? "Checking project access..."
              : "Loading project..."}
          </p>
        </div>
      </div>
    );
  }

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
            ref={containerCallbackRef}
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
