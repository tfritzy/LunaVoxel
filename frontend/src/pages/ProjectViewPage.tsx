import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { CameraStatePersistence } from "@/modeling/lib/camera-controller-persistence";
import { ExportType } from "@/modeling/export/model-exporter";
import { useCurrentProject } from "@/lib/useCurrentProject";
import { ProjectLayout } from "@/components/custom/ProjectLayout";
import { useAtlas } from "@/lib/useAtlas";
import { useAuth } from "@/firebase/AuthContext";
import { SignInModal } from "@/components/custom/SignInModal";
import { createProject } from "@/lib/createProject";
import { useProjectAccess } from "@/lib/useProjectAccess";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { BlockModificationMode } from "@/module_bindings";

export const ProjectViewPage = () => {
  const projectId = useParams<{ projectId: string }>().projectId || "";
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<ToolType>("Rect");
  const [currentMode, setCurrentMode] = useState<BlockModificationMode>({ tag: "Attach" });
  const project = useCurrentProject(connection, projectId);
  const [loading, setLoading] = useState<boolean>(true);
  const atlasData = useAtlas();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { accessLevel } = useProjectAccess(connection, projectId);

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
    setLoading(true);
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
        `SELECT * FROM projects`,
        `SELECT * FROM project_blocks WHERE ProjectId='${projectId}'`,
        `SELECT * FROM layer WHERE ProjectId='${projectId}'`,
        `SELECT * FROM player_cursor WHERE ProjectId='${projectId}'`,
        `SELECT * FROM selections WHERE ProjectId='${projectId}'`,
        `SELECT * FROM chunk WHERE ProjectId='${projectId}'`,
        `SELECT * FROM user_projects`,
      ]);

    return () => {
      subscription.unsubscribe();
    };
  }, [connection, projectId]);

  useEffect(() => {
    engineRef.current?.projectManager?.builder?.setSelectedBlock(
      selectedBlock,
      setSelectedBlock
    );
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
        if (!node.isConnected || engineRef.current) return;

        const savedCameraState = CameraStatePersistence.load(projectId);
        engineRef.current = new VoxelEngine({
          container: node,
          connection,
          project,
          initialCameraState: savedCameraState || undefined,
        });

        engineRef.current.projectManager.builder.setSelectedBlock(
          selectedBlock,
          setSelectedBlock
        );
        engineRef.current.projectManager.builder.setTool(currentTool);
        engineRef.current.projectManager.setAtlasData(atlasData);
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
      engineRef.current.projectManager.builder.setTool(currentTool);
    }
  }, [currentTool]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.projectManager.builder.setMode(currentMode);
    }
  }, [currentMode]);

  useEffect(() => {
    if (engineRef.current?.projectManager && atlasData) {
      engineRef.current.projectManager.setAtlasData(atlasData);
    }
  }, [atlasData]);

  const handleToolChange = useCallback((tool: ToolType) => {
    setCurrentTool(tool);
  }, []);

  const handleModeChange = useCallback((mode: BlockModificationMode) => {
    setCurrentMode(mode);
  }, []);

  const createNewProject = useCallback(() => {
    createProject(connection, navigate);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  let modal = null;
  if (!project) {
    const isAnonymous = currentUser?.isAnonymous;

    modal = (
      <div className="h-screen flex items-center justify-center bg-background">
        {isAnonymous ? (
          <SignInModal
            title="Sign in"
            subheader="To continue to LunaVoxel"
            onSignIn={() => {}}
          />
        ) : (
          <div className="bg-background border border-border rounded-lg p-12 py-12 max-w-md w-full mx-4 pointer-events-auto shadow-2xl">
            <div className="space-y-6">
              <div className="">
                <h1 className="text-3xl font-bold text-foreground mb-3">
                  Project not found
                </h1>
                <div className="text-muted-foreground">
                  This project hasn't been shared with you or may not exist.
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={createNewProject}
                  className="flex flex-row cursor-pointer rounded items-center justify-center w-full border bg-background shadow-xs hover:bg-accent py-3 dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
                >
                  <span>Create New Project</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ProjectLayout
      projectId={projectId}
      selectedBlock={selectedBlock}
      setSelectedBlock={setSelectedBlock}
      currentTool={currentTool}
      currentMode={currentMode}
      onToolChange={handleToolChange}
      onModeChange={handleModeChange}
      onExport={handleExport}
      onSelectLayer={handleLayerSelect}
      onUndo={handleUndo}
      onRedo={handleRedo}
      atlasData={atlasData}
      accessLevel={accessLevel}
    >
      {modal}
      <div
        ref={containerCallbackRef}
        className="w-full h-full bg-background"
      />
    </ProjectLayout>
  );
};
