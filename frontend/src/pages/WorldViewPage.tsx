import { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoxelEngine } from "../modeling/voxel-engine";
import { World } from "../module_bindings";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import { useDatabase } from "@/contexts/DatabaseContext";

export default function WorldViewPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [world, setWorld] = useState<World | null>(null);

  useEffect(() => {
    if (!worldId || !connection || !containerRef.current) return;

    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    const worldData = connection.db.world.id.find(worldId);
    if (worldData) {
      setWorld(worldData);
    } else {
      connection
        .subscriptionBuilder()
        .onApplied(() => {
          const foundWorld = connection.db.world.id.find(worldId);
          if (foundWorld) {
            setWorld(foundWorld);
          } else {
            console.error(`World ${worldId} not found`);
            navigate("/");
          }
        })
        .subscribe([`SELECT * FROM World WHERE Id='${worldId}'`]);
    }

    connection
      .subscriptionBuilder()
      .onApplied(() => {
        setIsLoading(false);

        engineRef.current = new VoxelEngine({
          container: containerRef.current!,
          connection,
          worldId,
        });
      })
      .onError((error) => {
        console.error("Error subscribing to chunks:", error);
        setIsLoading(false);
      })
      .subscribe([`SELECT * FROM Chunk WHERE World='${worldId}'`]);

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [worldId, connection, navigate]);

  const handleBackToList = () => {
    navigate("/");
  };

  const handleShareWorld = () => {
    if (!worldId) return;

    const shareUrl = `${window.location.origin}/worlds/${worldId}`;

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        alert("World URL copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy URL: ", err);
      });
  };

  return (
    <div className="relative h-screen w-full">
      {isLoading ? (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* World viewer container */}
          <div
            ref={containerRef}
            className="voxel-container"
            style={{
              width: "100%",
              height: "100vh",
              position: "relative",
            }}
          />

          {/* UI overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm"
              onClick={handleBackToList}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Worlds
            </Button>

            {world && (
              <div className="p-2 rounded bg-background/80 backdrop-blur-sm">
                <h1 className="text-lg font-bold">{world.name}</h1>
                <p className="text-xs">
                  Size: {world.xWidth}x{world.yWidth}x{world.height}
                </p>
              </div>
            )}
          </div>

          {/* Share button */}
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm"
              onClick={handleShareWorld}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
