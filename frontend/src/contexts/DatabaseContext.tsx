// contexts/DatabaseContext.tsx
import React, { createContext, useContext } from "react";
import { DbConnection } from "../module_bindings";

interface DatabaseContextType {
  connection: DbConnection | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined
);

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

export function DatabaseProvider({
  children,
  connection,
}: {
  children: React.ReactNode;
  connection: DbConnection | null;
}) {
  return (
    <DatabaseContext.Provider value={{ connection }}>
      {children}
    </DatabaseContext.Provider>
  );
}
