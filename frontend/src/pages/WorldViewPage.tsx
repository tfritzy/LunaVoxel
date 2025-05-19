import { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { World } from "../module_bindings";
import { useDatabase } from "@/contexts/DatabaseContext";
import PerformanceStats from "@/components/custom/PerformanceStats";

export default function WorldViewPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!worldId || !connection) return;

    const worldData = connection.db.world.id.find(worldId);
    if (worldData) {
      setWorld(worldData);
      setIsReady(true);
    } else {
      const sub = connection
        .subscriptionBuilder()
        .onApplied(() => {
          const foundWorld = connection.db.world.id.find(worldId);
          if (foundWorld) {
            setWorld(foundWorld);
            setIsReady(true);
          } else {
            setError(`World ${worldId} not found`);
            setTimeout(() => navigate("/"), 2000);
          }
        })
        .onError((err) => {
          setError(`Error loading world: ${err.message}`);
          setTimeout(() => navigate("/"), 2000);
        })
        .subscribe([`SELECT * FROM World WHERE Id='${worldId}'`]);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [worldId, connection, navigate]);

  useEffect(() => {
    if (!isReady || !worldId || !connection || !containerRef.current) return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    setIsLoading(true);

    const sub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        if (containerRef.current) {
          setTimeout(() => {
            try {
              engineRef.current = new VoxelEngine({
                container: containerRef.current!,
                connection,
                worldId,
              });
              setIsLoading(false);
            } catch (err) {
              console.error("Error initializing engine:", err);
              setError("Failed to initialize 3D view");
              setIsLoading(false);
            }
          }, 100);
        }
      })
      .onError((err) => {
        console.error("Error subscribing to chunks:", err);
        setError(`Error loading chunks: ${err.message}`);
        setIsLoading(false);
      })
      .subscribe([`SELECT * FROM Chunk WHERE World='${worldId}'`]);

    return () => {
      sub.unsubscribe();
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [isReady, worldId, connection, navigate]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-screen w-full">
      <PerformanceStats />

      <div
        ref={containerRef}
        className="voxel-container"
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
        }}
      />

      {isLoading && (
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
            <p className="text-xl text-destructive font-medium mb-4">{error}</p>
            <p className="text-muted-foreground">Returning to world list...</p>
          </div>
        </div>
      )}
    </div>
  );
}
