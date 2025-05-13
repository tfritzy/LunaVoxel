import { useState, useCallback } from "react";
import { DbConnection, EventContext, World } from "../module_bindings";

export function useWorldManagement(
  onWorldConnected: (connection: DbConnection, world: string) => void
) {
  const [currentWorldId, setCurrentWorldId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myWorlds, setMyWorlds] = useState<World[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const createNewWorld = useCallback((conn: DbConnection) => {
    if (!conn.isActive) return;

    try {
      const defaultName = `World ${Date.now().toString().slice(-6)}`;
      conn.reducers.createWorld(defaultName, 16, 16, 16);
    } catch (err) {
      console.error("Error creating new world:", err);
    }
  }, []);

  const initialize = useCallback(
    (conn: DbConnection) => {
      console.log("initialize called", conn, isInitialized);
      if (!conn.isActive || isInitialized) return;

      console.log("Initializing world management");

      const onWorldInsert = (ctx: EventContext, world: World) => {
        if (!conn.identity) return;

        if (world.owner.isEqual(conn.identity)) {
          console.log("New world inserted:", world.name);
          setMyWorlds((prev) => [...prev, world]);

          if (isLoading) {
            setCurrentWorldId(world.id);
            setIsLoading(false);
          }
        }
      };

      const onWorldUpdate = (
        ctx: EventContext,
        oldWorld: World,
        newWorld: World
      ) => {
        if (!conn.identity) return;

        if (newWorld.owner.isEqual(conn.identity)) {
          setMyWorlds((prev) =>
            prev.map((world) => (world.id === newWorld.id ? newWorld : world))
          );
        }
      };

      const handleSubscriptionApplied = () => {
        console.log(
          "World subscription applied, found worlds:",
          Array.from(conn.db.world.iter()).length
        );

        const userWorlds = Array.from(conn.db.world.iter());

        setMyWorlds(userWorlds);

        if (userWorlds.length > 0) {
          const sortedWorlds = [...userWorlds].sort(
            (a, b) =>
              b.lastVisited.toDate().getTime() -
              a.lastVisited.toDate().getTime()
          );

          const mostRecentWorld = sortedWorlds[0];
          console.log("Selected most recent world:", mostRecentWorld.name);
          setCurrentWorldId(mostRecentWorld.id);
          conn.reducers.visitWorld(mostRecentWorld.id);
          onWorldConnected(conn, mostRecentWorld.id);
          setIsLoading(false);
        } else {
          console.log("No worlds found, creating a new one");
          createNewWorld(conn);
        }
      };

      try {
        conn.db.world.onInsert(onWorldInsert);
        conn.db.world.onUpdate(onWorldUpdate);

        if (conn.identity) {
          const myIdentityHex = conn.identity.toHexString();
          console.log("Subscribing to worlds for identity:", myIdentityHex);

          conn
            .subscriptionBuilder()
            .onApplied(handleSubscriptionApplied)
            .onError((error) => {
              console.error("World subscription error:", error);
              setIsLoading(false);
            })
            .subscribe([`SELECT * FROM World WHERE Owner='${myIdentityHex}'`]);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing world management:", error);
        setIsLoading(false);
      }

      return () => {
        if (conn && conn.isActive) {
          conn.db.world.removeOnInsert(onWorldInsert);
          conn.db.world.removeOnUpdate(onWorldUpdate);
        }
      };
    },
    [createNewWorld, isInitialized, isLoading]
  );

  const reset = useCallback(() => {
    console.log("Resetting world management state");
    setIsInitialized(false);
    setMyWorlds([]);
    setCurrentWorldId(null);
    setIsLoading(true);
  }, []);

  const selectWorld = useCallback((conn: DbConnection, worldId: string) => {
    if (!conn.isActive) return;

    try {
      setCurrentWorldId(worldId);
      conn.reducers.visitWorld(worldId);
      onWorldConnected(conn, worldId);
    } catch (err) {
      console.error("Error selecting world:", err);
    }
  }, []);

  return {
    currentWorldId,
    isLoading,
    myWorlds,
    selectWorld,
    createNewWorld,
    initialize,
    reset,
  };
}
