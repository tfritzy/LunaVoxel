import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import FirebaseAuth from "./firebase/FirebaseAuth";
import { DatabaseProvider } from "./contexts/DatabaseContext";
import WorldListPage from "./pages/WorldListPage";
import WorldViewPage from "./pages/WorldViewPage";
import Navigation from "./components/custom/Navigation";

function AppContent() {
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const { currentUser } = useAuth();

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
      setConn(connection);
      localStorage.setItem("auth_token", token);
    };

    const onDisconnect = () => {
      console.log("Disconnected from SpacetimeDB");
      setConn(null);
      setIdentity(null);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log("Error connecting to SpacetimeDB:", err);
      setConn(null);
    };

    try {
      currentUser?.getIdToken().then((idToken) => {
        DbConnection.builder()
          .withUri("ws://localhost:3000")
          .withModuleName("quickstart-chat")
          .withToken(idToken || localStorage.getItem("auth_token") || "")
          .onConnect(onConnect)
          .onDisconnect(onDisconnect)
          .onConnectError(onConnectError)
          .build();
      });
    } catch (err) {
      console.error("Error initializing connection:", err);
    }
  }, [currentUser]);

  return (
    <DatabaseProvider connection={conn}>
      <div className="app">
        <Navigation />
        <main className="app-content pt-14">
          <Routes>
            <Route path="/" element={<WorldListPage />} />
            <Route path="/worlds/:worldId" element={<WorldViewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <FirebaseAuth />
        </main>
      </div>
    </DatabaseProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
