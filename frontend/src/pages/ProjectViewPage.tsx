import { useRef, useEffect, useState, useCallback } from "react";
import { VoxelEngine } from "../modeling/voxel-engine";
import { CameraStatePersistence } from "@/modeling/lib/camera-controller-persistence";
import { ExportType } from "@/modeling/export/model-exporter";
import { ProjectLayout } from "@/components/custom/ProjectLayout";
import { ResizeProjectModal } from "@/components/custom/ResizeProjectModal";
import { useAtlas } from "@/lib/useAtlas";
import type { ToolType } from "@/modeling/lib/tool-type";
import type { ToolOption } from "@/modeling/lib/tool-interface";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import { stateStore, useGlobalState } from "@/state/store";

export const ProjectViewPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<ToolType>("Rect");
  const [currentMode, setCurrentMode] = useState<BlockModificationMode>({ tag: "Attach" });
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([]);
  const [resizeModalOpen, setResizeModalOpen] = useState(false);
  const project = useGlobalState((state) => state.project);
  const projectId = project.id;
  const atlasData = useAtlas();

  const handleObjectSelect = useCallback((objectIndex: number) => {
    engineRef.current?.projectManager?.builder.setSelectedObject(objectIndex);
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

  const handleResizeProject = useCallback((newDimensions: Vector3, anchor: Vector3) => {
    stateStore.reducers.resizeProject(newDimensions, anchor);
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
          stateStore,
          project,
          initialCameraState: savedCameraState || undefined,
        });

        engineRef.current.projectManager.builder.setSelectedBlock(
          selectedBlock,
          setSelectedBlock
        );
        engineRef.current.projectManager.builder.setTool(currentTool);
        engineRef.current.projectManager.setAtlasData(atlasData);
        setToolOptions(engineRef.current.projectManager.builder.getToolOptions());
      });
    },
    [project, projectId, atlasData, selectedBlock, currentTool]
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

  const handleToolOptionChange = useCallback((name: string, value: string) => {
    if (engineRef.current) {
      engineRef.current.projectManager.builder.setToolOption(name, value);
      setToolOptions(engineRef.current.projectManager.builder.getToolOptions());
    }
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      setToolOptions(engineRef.current.projectManager.builder.getToolOptions());
    }
  }, [currentTool]);

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
      onSelectObject={handleObjectSelect}
      onUndo={handleUndo}
      onRedo={handleRedo}
      onResizeProject={() => setResizeModalOpen(true)}
      toolOptions={toolOptions}
      onToolOptionChange={handleToolOptionChange}
    >
      <div
        ref={containerCallbackRef}
        className="w-full h-full bg-background"
      />
      <ResizeProjectModal
        isOpen={resizeModalOpen}
        onClose={() => setResizeModalOpen(false)}
        currentDimensions={project.dimensions}
        onResize={handleResizeProject}
      />
    </ProjectLayout>
  );
};
