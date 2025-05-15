import { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";

export default function WorldViewPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!worldId || !connection || !containerRef.current) return;

    setIsLoading(true);

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    const worldData = connection.db.world.id.find(worldId);
    if (!worldData) {
      navigate("/");
      return;
    }

    const sub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        if (!containerRef.current) return;
        engineRef.current = new VoxelEngine({
          container: containerRef.current!,
          connection,
          worldId,
        });
        setIsLoading(false);
      })
      .onError((error) => {
        console.error("Error subscribing to chunks:", error);
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
  }, [worldId, connection, navigate]);

  return (
    <div className="relative h-screen w-full">
      <div
        key="container"
        ref={containerRef}
        className="voxel-container"
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
        }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background bg-opacity-50 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-t-accent border-r-transparent border-b-accent border-l-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium">Loading world...</p>
          </div>
        </div>
      )}
    </div>
  );
}
