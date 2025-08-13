import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { FloatingToolbar } from "@/components/custom/FloatingToolbar";
import { BlockModificationMode } from "@/module_bindings";
import { ProjectHeader } from "@/components/custom/ProjectHeader";
import { useProjectMeta, useAtlasContext, useBlocksContext } from "@/contexts/CurrentProjectContext";
import { BlockDrawer } from "@/components/custom/blocks/BlockDrawer";
import { RightSideDrawer } from "@/components/custom/RightSideDrawer";
import { useCustomCursor } from "@/lib/useCustomCursor";

export const ProjectViewPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [cursorsLoading, setCursorsLoading] = useState(true);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({ tag: "Build" });
  const { selectedBlock, blocks } = useBlocksContext();
  const { project } = useProjectMeta();
  const { atlas, textureAtlas } = useAtlasContext();

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

    setCursorsLoading(true);

    const cursorsSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setCursorsLoading(false);
      })
      .onError((err) => {
        console.error("Error subscribing to cursors:", err);
        setCursorsLoading(false);
      })
      .subscribe([`SELECT * FROM player_cursor WHERE ProjectId='${projectId}'`]);

    return () => {
      cursorsSub.unsubscribe();
      setCursorsLoading(true);

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [projectId, connection]);

  useEffect(() => {
    if (cursorsLoading || !connection) return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    engineRef.current = new VoxelEngine({
      container: containerRef.current!,
      connection,
      project,
    });

    engineRef.current.projectManager.setSelectedBlock(selectedBlock);
    engineRef.current.projectManager.setTool(currentTool);
    engineRef.current.projectManager.setAtlas(atlas);
    engineRef.current.projectManager.setBlocks(blocks);
    engineRef.current.projectManager.setTextureAtlas(textureAtlas);

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, cursorsLoading]);

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
  }, [cursorsLoading]);

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
    if (engineRef.current) {
      engineRef.current.projectManager.setBlocks(blocks);
    }
  }, [blocks]);

  useEffect(() => {
    if (engineRef.current && textureAtlas) {
      engineRef.current.projectManager.setTextureAtlas(textureAtlas);
    }
  }, [textureAtlas]);

  const handleToolChange = (tool: BlockModificationMode) => {
    setCurrentTool(tool);
  };

  return (
    <div>
      <ProjectHeader onExportOBJ={handleExportOBJ} />
      <div className="h-full flex">
        <div className="flex-1 relative">
          <BlockDrawer />

          <div
            ref={containerRef}
            className="h-full"
            style={{ height: "calc(100vh - 64px)", cursor: customCursor }}
          />

          {!cursorsLoading && (
            <FloatingToolbar currentTool={currentTool} onToolChange={handleToolChange} />
          )}

          <RightSideDrawer onSelectLayer={handleLayerSelect} />
        </div>
      </div>
    </div>
  );
};