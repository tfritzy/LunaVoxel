// contexts/DatabaseContext.tsx
import React, { createContext, useContext } from "react";
import { stateStore, type StateStore } from "@/state/store";

const DatabaseContext = createContext<StateStore | undefined>(undefined);

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    return stateStore;
  }
  return context;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <DatabaseContext.Provider value={stateStore}>
      {children}
    </DatabaseContext.Provider>
  );
}
