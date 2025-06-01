import { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";
import ColorPalette from "@/components/custom/ColorPalette";
import FloatingToolbar from "@/components/custom/FloatingToolbar";
import { useWorlds } from "@/contexts/WorldContext";
import { BlockModificationMode } from "@/module_bindings";
import Navigation from "@/components/custom/Navigation";

export default function WorldViewPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [chunksLoading, setChunksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<BlockModificationMode>({
    tag: "Build",
  });
  const { userWorlds } = useWorlds();

  useEffect(() => {
    if (!worldId || !connection) return;

    setChunksLoading(true);

    const sub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        setChunksLoading(false);
      })
      .onError((err) => {
        console.error("Error subscribing to chunks:", err);
        setError(`Error loading chunks: ${err}`);
        setChunksLoading(false);
      })
      .subscribe([
        `SELECT * FROM Chunk WHERE World='${worldId}'`,
        `SELECT * FROM PreviewVoxels WHERE World='${worldId}'`,
      ]);

    return () => {
      sub.unsubscribe();
      setChunksLoading(true);

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [worldId, connection, navigate]);

  useEffect(() => {
    if (chunksLoading || !connection) return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    const world = userWorlds.find((w) => w.id === worldId);

    if (!world) {
      setError("Unable to find world " + worldId);
      return;
    }

    engineRef.current = new VoxelEngine({
      container: containerRef.current!,
      connection,
      world,
    });

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [chunksLoading, connection, userWorlds, worldId]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTool(currentTool);
    }
  }, [currentTool]);

  const handleToolChange = (tool: BlockModificationMode) => {
    setCurrentTool(tool);
  };

  return (
    <div>
      <Navigation />
      <div className="h-full flex">
        {!chunksLoading && !error && worldId && (
          <ColorPalette worldId={worldId} />
        )}

        <div className="flex-1 relative">
          <div
            ref={containerRef}
            className="voxel-container"
            style={{
              width: "100%",
              height: "100vh",
              position: "relative",
            }}
          />

          {!chunksLoading && !error && (
            <FloatingToolbar
              currentTool={currentTool}
              onToolChange={handleToolChange}
            />
          )}

          {chunksLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
                <p className="text-lg font-medium">Loading world...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-20">
              <div className="bg-card p-6 rounded-lg shadow-lg max-w-md text-center">
                <p className="text-xl text-destructive font-medium mb-4">
                  {error}
                </p>
                <p className="text-muted-foreground">
                  Returning to world list...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
