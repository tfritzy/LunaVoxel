import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { FloatingToolbar } from "@/components/custom/FloatingToolbar";
import { BlockModificationMode } from "@/module_bindings";
import { ProjectHeader } from "@/components/custom/ProjectHeader";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { Button } from "@/components/ui/button";
import { BlockDrawer } from "@/components/custom/blocks/BlockDrawer";
import { RightSideDrawer } from "@/components/custom/RightSideDrawer";
import { useCustomCursor } from "@/lib/useCustomCursor";

export const ProjectViewPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [cursorsLoading, setCursorsLoading] = useState(true);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const {
    selectedBlock,
    project,
    atlas,
    textureAtlas,
    blocks,
    layers,
    selectedLayer,
  } = useCurrentProject();

  const customCursor = useCustomCursor(currentTool);

  useEffect(() => {
    engineRef.current?.projectManager?.setSelectedBlock(selectedBlock);
  }, [selectedBlock]);

  useEffect(() => {
    engineRef.current?.projectManager?.builder.setSelectedLayer(selectedLayer);
  }, [selectedLayer]);

  useEffect(() => {
    engineRef.current?.projectManager?.updateLayers(layers);
  }, [layers]);

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
      .subscribe([
        `SELECT * FROM player_cursor WHERE ProjectId='${projectId}'`,
      ]);

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
      <ProjectHeader />
      <div className="h-full flex">
        <div className="flex-1 relative">
          <BlockDrawer />

          <div
            ref={containerRef}
            className="h-full"
            style={{
              height: "calc(100vh - 64px)",
              cursor: customCursor,
            }}
          />

          {!cursorsLoading && (
            <FloatingToolbar
              currentTool={currentTool}
              onToolChange={handleToolChange}
            />
          )}

          <RightSideDrawer />
        </div>
      </div>
    </div>
  );
};
