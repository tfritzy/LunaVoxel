import { useState, useCallback, useEffect } from "react";
import { DbConnection, EventContext, World } from "../module_bindings";
import { useDatabase } from "@/contexts/DatabaseContext";

export function useWorldManagement() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [myWorlds, setMyWorlds] = useState<World[]>([]);
  const { connection } = useDatabase();

  console.log("use world management", myWorlds, isInitialized);

  const initialize = useCallback(
    (conn: DbConnection) => {
      if (!conn || isInitialized) return;

      const onWorldInsert = (ctx: EventContext, world: World) => {
        if (!conn.identity) return;
        if (world.owner.isEqual(conn.identity)) {
          setMyWorlds((prev) => {
            const existingIndex = prev.findIndex(
              (existingWorld) => existingWorld.id === world.id
            );

            if (existingIndex !== -1) {
              const updatedWorlds = [...prev];
              updatedWorlds[existingIndex] = world;
              return updatedWorlds;
            }

            return [...prev, world];
          });
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
        const userWorlds = Array.from(conn.db.world.iter());

        setMyWorlds(userWorlds);
      };

      try {
        conn.db.world.onInsert(onWorldInsert);
        conn.db.world.onUpdate(onWorldUpdate);

        if (conn.identity) {
          const myIdentityHex = conn.identity.toHexString();

          conn
            .subscriptionBuilder()
            .onApplied(handleSubscriptionApplied)
            .onError((error) => {
              console.error("World subscription error:", error);
            })
            .subscribe([`SELECT * FROM World WHERE Owner='${myIdentityHex}'`]);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing world management:", error);
      }

      return () => {
        if (conn && conn.isActive) {
          conn.db.world.removeOnInsert(onWorldInsert);
          conn.db.world.removeOnUpdate(onWorldUpdate);
        }
      };
    },
    [isInitialized]
  );

  useEffect(() => {
    if (!isInitialized && connection) {
      initialize(connection);
    }
  }, [connection, initialize, isInitialized]);

  const reset = useCallback(() => {
    console.log("Resetting world management state");
    setIsInitialized(false);
    setMyWorlds([]);
  }, []);

  return {
    isLoading: !isInitialized,
    myWorlds,
    reset,
  };
}
