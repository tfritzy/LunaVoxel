import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { World, EventContext } from "../module_bindings";
import CreateWorldButton from "@/components/custom/CreateWorldButton";
import { useDatabase } from "@/contexts/DatabaseContext";

export default function WorldListPage() {
  const navigate = useNavigate();
  const { connection } = useDatabase();
  const [isLoading, setIsLoading] = useState(true);
  const [worlds, setWorlds] = useState<World[]>([]);

  useEffect(() => {
    const onWorldInsert = (ctx: EventContext, world: World) => {
      if (!connection.identity) return;

      if (world.owner.isEqual(connection.identity)) {
        setWorlds((prev) => [...prev, world]);
      }
    };

    const onWorldUpdate = (
      ctx: EventContext,
      oldWorld: World,
      newWorld: World
    ) => {
      if (!connection.identity) return;

      if (newWorld.owner.isEqual(connection.identity)) {
        setWorlds((prev) =>
          prev.map((world) => (world.id === newWorld.id ? newWorld : world))
        );
      }
    };

    const handleSubscriptionApplied = () => {
      console.log("World subscription applied");
      setIsLoading(false);

      if (connection.identity) {
        const userWorlds = Array.from(connection.db.world.iter()).filter(
          (world) => world.owner.isEqual(connection.identity!)
        );

        const sortedWorlds = [...userWorlds].sort(
          (a, b) =>
            b.lastVisited.toDate().getTime() - a.lastVisited.toDate().getTime()
        );

        setWorlds(sortedWorlds);
      }
    };

    connection.db.world.onInsert(onWorldInsert);
    connection.db.world.onUpdate(onWorldUpdate);

    if (connection.identity) {
      const myIdentityHex = connection.identity.toHexString();
      console.log("Subscribing to worlds for identity:", myIdentityHex);

      connection
        .subscriptionBuilder()
        .onApplied(handleSubscriptionApplied)
        .onError((error) => {
          console.error("World subscription error:", error);
          setIsLoading(false);
        })
        .subscribe([`SELECT * FROM World WHERE Owner='${myIdentityHex}'`]);
    }

    return () => {
      if (connection && connection.isActive) {
        connection.db.world.removeOnInsert(onWorldInsert);
        connection.db.world.removeOnUpdate(onWorldUpdate);
      }
    };
  }, [connection]);

  const visitWorld = (worldId: string) => {
    if (!connection.isActive) return;

    try {
      connection.reducers.visitWorld(worldId);

      navigate(`/worlds/${worldId}`);
    } catch (err) {
      console.error("Error selecting world:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Worlds</h1>

      <div className="mb-4">
        <CreateWorldButton />
      </div>

      {worlds.length === 0 ? (
        <div className="text-center p-8 border rounded">
          <p className="mb-4">You don't have any worlds yet.</p>
          <CreateWorldButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worlds.map((world) => (
            <div
              key={world.id}
              className="border rounded p-4 cursor-pointer hover:bg-secondary/10"
              onClick={() => visitWorld(world.id)}
            >
              <h2 className="text-xl font-semibold">{world.name}</h2>
              <p>
                Size: {world.xWidth}x{world.yWidth}x{world.height}
              </p>
              <p className="text-sm text-muted-foreground">
                Last visited: {world.lastVisited.toDate().toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
