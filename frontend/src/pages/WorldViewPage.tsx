import { useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { useDatabase } from "@/contexts/DatabaseContext";

export default function WorldViewPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);

  useEffect(() => {
    if (!worldId || !connection || !containerRef.current) return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    const worldData = connection.db.world.id.find(worldId);
    if (!worldData) {
      navigate("/");
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
      })
      .onError((error) => {
        console.error("Error subscribing to chunks:", error);
      })
      .subscribe([`SELECT * FROM Chunk WHERE World='${worldId}'`]);

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }

      sub.unsubscribe();
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
    </div>
  );
}
