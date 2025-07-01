import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import { FloatingToolbar } from "@/components/custom/FloatingToolbar";
import { BlockModificationMode } from "@/module_bindings";
import { ProjectHeader } from "@/components/custom/ProjectHeader";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { Button } from "@/components/ui/button";
import { Atlas } from "@/components/custom/atlas/Atlas";

export const ProjectViewPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [chunksLoading, setChunksLoading] = useState(true);
  const [cursorsLoading, setCursorsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const { selectedColor, project, atlas, textureAtlas } = useCurrentProject();

  useEffect(() => {}, [selectedColor]);

  useEffect(() => {
    if (!projectId || !connection) return;

    setChunksLoading(true);
    setCursorsLoading(true);

    const chunksSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setChunksLoading(false);
      })
      .onError((err) => {
        console.error("Error subscribing to chunks:", err);
        setError(`Error loading chunks: ${err}`);
        setChunksLoading(false);
      })
      .subscribe([`SELECT * FROM chunk WHERE ProjectId='${projectId}'`]);

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
      chunksSub.unsubscribe();
      cursorsSub.unsubscribe();
      setChunksLoading(true);
      setCursorsLoading(true);

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [projectId, connection]);

  useEffect(() => {
    if (chunksLoading || cursorsLoading || !connection) return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    engineRef.current = new VoxelEngine({
      container: containerRef.current!,
      connection,
      project,
    });

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [chunksLoading, cursorsLoading, connection, project, projectId]);

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

  const handleToolChange = (tool: BlockModificationMode) => {
    setCurrentTool(tool);
  };

  return (
    <div>
      <ProjectHeader />
      <div className="h-full flex">
        {!chunksLoading && !cursorsLoading && !error && projectId && (
          <Atlas projectId={projectId} />
        )}

        <div className="flex-1 relative">
          <div
            ref={containerRef}
            className="w-full h-full bg-slate-900"
            style={{ height: "calc(100vh - 64px)" }}
          />

          {(chunksLoading || cursorsLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-white">Loading...</div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center text-white">
                <div className="mb-4">{error}</div>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!chunksLoading && !cursorsLoading && !error && (
            <FloatingToolbar
              currentTool={currentTool}
              onToolChange={handleToolChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};
