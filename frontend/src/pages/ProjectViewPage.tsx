import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { BlockModificationMode } from "@/module_bindings";
import { useCustomCursor } from "@/lib/useCustomCursor";
import { CameraStatePersistence } from "@/modeling/lib/camera-controller-persistence";
import { ExportType } from "@/modeling/export/model-exporter";
import { useCurrentProject } from "@/lib/useCurrentProject";
import { ProjectLayout } from "@/components/custom/ProjectLayout";
import { useAtlas } from "@/lib/useAtlas";

export const ProjectViewPage = () => {
  const projectId = useParams<{ projectId: string }>().projectId || "";
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const project = useCurrentProject(connection, projectId);
  const customCursor = useCustomCursor(currentTool);
  const [loading, setLoading] = useState<boolean>(true);
  const atlasData = useAtlas();

  const handleLayerSelect = useCallback((layerIndex: number) => {
    engineRef.current?.projectManager?.builder.setSelectedLayer(layerIndex);
  }, []);

  const handleExport = useCallback((type: ExportType) => {
    if (engineRef.current?.projectManager) {
      engineRef.current.projectManager.export(type);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (engineRef.current?.projectManager) {
      engineRef.current.projectManager.undo();
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (engineRef.current?.projectManager) {
      engineRef.current.projectManager.redo();
    }
  }, []);

  const disposeEngine = useCallback(() => {
    if (engineRef.current) {
      if (projectId) {
        const cameraState = engineRef.current.getCameraState();
        CameraStatePersistence.save(projectId, cameraState);
      }
      engineRef.current.dispose();
      engineRef.current = null;
      isInitializedRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (!connection) return;

    connection.reducers.pokeProject(projectId);
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
        `SELECT * FROM user_projects WHERE ProjectId='${projectId}'`,
      ]);

    return () => {
      subscription.unsubscribe();
    };
  }, [connection, projectId]);

  useEffect(() => {
    engineRef.current?.projectManager?.setSelectedBlock(selectedBlock);
  }, [selectedBlock]);

  useEffect(() => {
    return () => {
      disposeEngine();
    };
  }, [projectId, disposeEngine]);

  const containerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;

      if (
        !node ||
        !connection ||
        !project ||
        !projectId ||
        !atlasData ||
        isInitializedRef.current
      )
        return;

      isInitializedRef.current = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!node.isConnected || engineRef.current) return;

          const savedCameraState = CameraStatePersistence.load(projectId);
          engineRef.current = new VoxelEngine({
            container: node,
            connection,
            project,
            initialCameraState: savedCameraState || undefined,
          });

          engineRef.current.projectManager.setSelectedBlock(selectedBlock);
          engineRef.current.projectManager.setTool(currentTool);
          engineRef.current.projectManager.setAtlasData(atlasData);
        });
      });
    },
    [connection, project, projectId, atlasData, selectedBlock, currentTool]
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
    if (engineRef.current?.projectManager && atlasData) {
      engineRef.current.projectManager.setAtlasData(atlasData);
    }
  }, [atlasData]);

  const handleToolChange = useCallback((tool: BlockModificationMode) => {
    setCurrentTool(tool);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-medium">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectLayout
      projectId={projectId}
      selectedBlock={selectedBlock}
      setSelectedBlock={setSelectedBlock}
      currentTool={currentTool}
      onToolChange={handleToolChange}
      onExport={handleExport}
      onSelectLayer={handleLayerSelect}
      onUndo={handleUndo}
      onRedo={handleRedo}
      atlasData={atlasData}
    >
      <div
        ref={containerCallbackRef}
        className="w-full h-full bg-background"
        style={{ cursor: customCursor }}
      />
    </ProjectLayout>
  );
};
