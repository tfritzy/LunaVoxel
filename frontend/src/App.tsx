import { useRef, useEffect, useState } from "react";
import { VoxelEngine } from "./modeling/voxel-engine";
import { BlockType, DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { useChunks } from "./hooks/useChunks";

const world = "wrld_cd7cd7b7686d";
function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const chunks = useChunks(conn, world);

  useEffect(() => {
    if (!conn) return;
    conn.reducers.placeBlock(world, { tag: "Block" }, 1, 1, 1);
  }, [conn]);

  useEffect(() => {
    const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
      let count = 0;
      for (const query of queries) {
        console.log("Subscribe to ", query);
        conn
          ?.subscriptionBuilder()
          .onApplied(() => {
            count++;
            if (count === queries.length) {
              console.log("SDK client cache initialized.");
            }
          })
          .subscribe(query);
      }
    };

    const onConnect = (
      conn: DbConnection,
      identity: Identity,
      token: string
    ) => {
      setIdentity(identity);
      setConnected(true);
      localStorage.setItem("auth_token", token);
      console.log(
        "Connected to SpacetimeDB with identity:",
        identity.toHexString()
      );
      conn.reducers.onCreateWorld(() => {
        console.log("World created.");
      });
      conn.reducers.onPlaceBlock(() => {
        console.log("Block placed.");
      });

      subscribeToQueries(conn, [
        "SELECT * FROM Chunk where World='" + world + "'",
      ]);
    };

    const onDisconnect = () => {
      console.log("Disconnected from SpacetimeDB");
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log("Error connecting to SpacetimeDB:", err);
    };

    setConn(
      DbConnection.builder()
        .withUri("ws://localhost:3000")
        .withModuleName("quickstart-chat")
        .withToken(localStorage.getItem("auth_token") || "")
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build()
    );
  }, []);

  useEffect(() => {
    // Only initialize if the container exists and engine hasn't been created yet
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new VoxelEngine({
        container: containerRef.current,
      });
    }

    // Cleanup function to properly dispose of resources
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs once on mount

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
      </main>
    </div>
  );
}

export default App;
