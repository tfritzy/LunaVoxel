import { useRef, useEffect, useState, useCallback } from "react";
import { VoxelEngine } from "../modeling/voxel-engine";
import { CameraStatePersistence } from "@/modeling/lib/camera-controller-persistence";
import { ExportType } from "@/modeling/export/model-exporter";
import { EditorLayout } from "@/components/custom/EditorLayout";
import { useAtlas } from "@/lib/useAtlas";
import type { ToolType } from "@/modeling/lib/tool-type";
import { useLayers, useChunks, type BlockModificationMode } from "@/state";

const EDITOR_ID = "editor";

export const EditorPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<ToolType>("Rect");
  const [currentMode, setCurrentMode] = useState<BlockModificationMode>({ tag: "Attach" });
  const layers = useLayers();
  const chunks = useChunks();
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
      const cameraState = engineRef.current.getCameraState();
      CameraStatePersistence.save(EDITOR_ID, cameraState);
      engineRef.current.dispose();
      engineRef.current = null;
      isInitializedRef.current = false;
    }
  }, []);

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
  }, [disposeEngine]);

  const containerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;

      if (
        !node ||
        layers.length === 0 ||
        !atlasData ||
        isInitializedRef.current
      )
        return;

      isInitializedRef.current = true;

      requestAnimationFrame(() => {
        if (!node.isConnected || engineRef.current) return;

        const savedCameraState = CameraStatePersistence.load(EDITOR_ID);
        const firstLayer = layers[0];
        
        engineRef.current = new VoxelEngine({
          container: node,
          dimensions: { x: firstLayer.xDim, y: firstLayer.yDim, z: firstLayer.zDim },
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
    [layers, atlasData, selectedBlock, currentTool]
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

  if (layers.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <EditorLayout
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
    >
      <div
        ref={containerCallbackRef}
        className="w-full h-full bg-background"
      />
    </EditorLayout>
  );
};
