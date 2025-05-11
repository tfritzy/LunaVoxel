import { useRef, useEffect, useState } from "react";
import { VoxelEngine } from "./modeling/voxel-engine";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import FirebaseAuth from "./firebase/FirebaseAuth";

const worldId = "wrld_cd7cd7b7686d";

function AppContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser && !conn) {
      initializeConnection();
    }
  }, [currentUser, conn]);

  const initializeConnection = () => {
    const subscribeToQueries = (
      connection: DbConnection,
      queries: string[]
    ) => {
      for (const query of queries) {
        console.log("Subscribe to ", query);
        connection
          ?.subscriptionBuilder()
          .onApplied(() => {
            engineRef.current?.onQueriesApplied();
          })
          .subscribe(query);
      }
    };

    const onConnect = (
      connection: DbConnection,
      identity: Identity,
      token: string
    ) => {
      setIdentity(identity);
      setConnected(true);
      localStorage.setItem("auth_token", token);

      subscribeToQueries(connection, [
        `SELECT * FROM World WHERE Id='${worldId}'`,
        `SELECT * FROM Chunk WHERE World='${worldId}'`,
      ]);
    };

    const onDisconnect = () => {
      console.log("Disconnected from SpacetimeDB");
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log("Error connecting to SpacetimeDB:", err);
    };

    // Get the token from the current user
    if (currentUser) {
      currentUser.getIdToken().then((idToken) => {
        setConn(
          DbConnection.builder()
            .withUri("ws://localhost:3000")
            .withModuleName("quickstart-chat")
            .withToken(idToken || localStorage.getItem("auth_token") || "")
            .onConnect(onConnect)
            .onDisconnect(onDisconnect)
            .onConnectError(onConnectError)
            .build()
        );
      });
    }
  };

  useEffect(() => {
    if (!conn) return;

    if (containerRef.current && !engineRef.current) {
      engineRef.current = new VoxelEngine({
        container: containerRef.current,
        conn,
        worldId,
      });
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [conn]);

  return (
    <div className="app">
      <main className="app-content">
        <div
          ref={containerRef}
          className="voxel-container"
          style={{
            width: "100%",
            height: "100vh",
            position: "relative",
          }}
        />
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
