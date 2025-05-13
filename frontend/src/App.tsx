import { useRef, useEffect, useState, useCallback } from "react";
import { VoxelEngine } from "./modeling/voxel-engine";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import FirebaseAuth from "./firebase/FirebaseAuth";
import { useWorldManagement } from "./hooks/useWorldManagement";
import React from "react";

function AppContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const { currentUser } = useAuth();

  const onWorldConnected = React.useCallback(
    (connection: DbConnection, world: string) => {
      connection
        .subscriptionBuilder()
        .onApplied(() => {
          if (engineRef.current) {
            engineRef.current.dispose();
            engineRef.current = null;
          }

          engineRef.current = new VoxelEngine({
            container: containerRef.current!,
            connection,
            worldId: world,
          });
        })
        .subscribe([`SELECT * FROM Chunk WHERE World='${world}'`]);
    },
    []
  );

  const {
    currentWorldId,
    isLoading,
    myWorlds,
    selectWorld,
    createNewWorld,
    initialize,
    reset,
  } = useWorldManagement(onWorldConnected);

  useEffect(() => {
    const onConnect = (
      connection: DbConnection,
      identity: Identity,
      token: string
    ) => {
      console.log(
        "Connected to SpacetimeDB with identity:",
        identity.toHexString()
      );
      setIdentity(identity);
      localStorage.setItem("auth_token", token);

      initialize(connection);
    };

    const onDisconnect = () => {
      console.log("Disconnected from SpacetimeDB");

      reset();

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log("Error connecting to SpacetimeDB:", err);
      reset();
    };

    try {
      currentUser?.getIdToken().then((idToken) => {
        const connection = DbConnection.builder()
          .withUri("ws://localhost:3000")
          .withModuleName("quickstart-chat")
          .withToken(idToken || localStorage.getItem("auth_token") || "")
          .onConnect(onConnect)
          .onDisconnect(onDisconnect)
          .onConnectError(onConnectError)
          .build();

        setConn(connection);
      });
    } catch (err) {
      console.error("Error initializing connection:", err);
    }
  }, []);

  const handleWorldChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!conn) return;
      const worldId = e.target.value;
      selectWorld(conn, worldId);
    },
    [conn, selectWorld]
  );

  return (
    <div className="app">
      <main className="app-content">
        {isLoading ? (
          <div className="loading-overlay">
            <div className="loading-spinner">Loading world...</div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="voxel-container"
            style={{
              width: "100%",
              height: "100vh",
              position: "relative",
            }}
          />
        )}
        <FirebaseAuth />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
