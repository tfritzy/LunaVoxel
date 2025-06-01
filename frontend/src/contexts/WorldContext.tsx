import { EventContext, World } from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";

interface WorldsContextType {
  userWorlds: World[];
}

const WorldsContext = createContext<WorldsContextType | undefined>(undefined);

export function useWorlds() {
  const context = useContext(WorldsContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

export function WorldsProvider({ children }: { children: React.ReactNode }) {
  const [worldsLoading, setWorldsLoading] = useState<boolean>(true);
  const [userWorlds, setUserWorlds] = useState<World[]>([]);
  const { connection } = useDatabase();

  useEffect(() => {
    if (!connection?.identity) throw "Connection has no identity";
    const myIdentityHex = connection.identity.toHexString();

    connection
      .subscriptionBuilder()
      .onApplied(() => {
        setWorldsLoading(false);
      })
      .onError((error) => {
        console.error("World subscription error:", error);
      })
      .subscribe([`SELECT * FROM World WHERE Owner='${myIdentityHex}'`]);

    const onWorldInsert = (ctx: EventContext, row: World) => {
      setUserWorlds((prev) => {
        const existingIndex = prev.findIndex(
          (existingWorld) => existingWorld.id === row.id
        );
        if (existingIndex !== -1) {
          const updatedWorlds = [...prev];
          updatedWorlds[existingIndex] = row;
          return updatedWorlds;
        } else {
          return [...prev, row];
        }
      });
    };

    const onWorldUpdate = (
      ctx: EventContext,
      oldWorld: World,
      newWorld: World
    ) => {
      setUserWorlds((prev) =>
        prev.map((world) => (world.id === newWorld.id ? newWorld : world))
      );
    };

    connection.db.world.onInsert(onWorldInsert);
    connection.db.world.onUpdate(onWorldUpdate);

    return () => {
      connection.db.world.removeOnInsert(onWorldInsert);
      connection.db.world.removeOnUpdate(onWorldUpdate);
    };
  }, [connection]);

  if (worldsLoading) return null;

  return (
    <WorldsContext.Provider value={{ userWorlds }}>
      {children}
    </WorldsContext.Provider>
  );
}
