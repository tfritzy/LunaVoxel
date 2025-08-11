import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import { DatabaseProvider } from "./contexts/DatabaseContext";
import { Layout } from "./components/custom/Layout";
import { ProjectsProvider } from "./contexts/ProjectsContext";
import { CurrentProjectProvider } from "./contexts/CurrentProjectContext";
import { CreateNewPage } from "./components/custom/CreateNewPage";
import { ProjectViewPage } from "./pages/ProjectViewPage";
import { Toaster } from "sonner";
import { ProjectsPage } from "./pages/ProjectsPage";

const getSpacetimeConfig = () => {
  const isDev = import.meta.env.DEV || window.location.hostname === "localhost";

  return {
    uri: isDev ? "ws://localhost:3000" : "wss://maincloud.spacetimedb.com",
  };
};

interface SyncUserRequest {
  idToken: string;
  identity: string;
  spacetimeToken: string;
}

interface SyncUserResult {
  success: boolean;
  uid?: string;
  error?: string;
}

function AppContent() {
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [userSynced, setUserSynced] = useState(false);
  const { currentUser } = useAuth();

  const syncUserWithCloudFunction = useCallback(
    async (idToken: string, identity: Identity, spacetimeToken: string) => {
      try {
        const functions = getFunctions();
        const syncUser = httpsCallable<SyncUserRequest, SyncUserResult>(
          functions,
          "syncUser"
        );

        const result = await syncUser({
          idToken,
          identity: identity.toHexString(),
          spacetimeToken,
        });

        if (result.data.success) {
          setUserSynced(true);
          return true;
        } else {
          console.error("Failed to sync user:", result.data.error);
          return false;
        }
      } catch (error) {
        console.error("Error calling syncUser:", error);
        return false;
      }
    },
    []
  );

  const handleConnect = useCallback(
    async (connection: DbConnection, identity: Identity, token: string) => {
      setConn(connection);
      localStorage.setItem("auth_token", token);

      if (currentUser && !userSynced) {
        const idToken = await currentUser.getIdToken();
        await syncUserWithCloudFunction(idToken, identity, token);
      }
    },
    [currentUser, userSynced, syncUserWithCloudFunction]
  );

  const handleDisconnect = useCallback(() => {
    console.log("Disconnected from SpacetimeDB");
    setConn(null);
    setUserSynced(false);
  }, []);

  const handleConnectError = useCallback((_ctx: ErrorContext, err: Error) => {
    console.log("Error connecting to SpacetimeDB:", err);
    setConn(null);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (conn) {
      console.log("Connection already exists, skipping");
      return;
    }

    const connectToSpaceTime = async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const config = getSpacetimeConfig();

        console.log("Connecting to SpacetimeDB:", config);

        DbConnection.builder()
          .withUri(config.uri)
          .withModuleName("lunavoxel")
          .withToken(idToken || localStorage.getItem("auth_token") || "")
          .onConnect(handleConnect)
          .onDisconnect(handleDisconnect)
          .onConnectError(handleConnectError)
          .build();
      } catch (err) {
        console.error("Error initializing connection:", err);
      }
    };

    connectToSpaceTime();
  }, [currentUser, conn, handleConnect, handleDisconnect, handleConnectError]);

  if (!conn) return null;

  return (
    <DatabaseProvider connection={conn}>
      <ProjectsProvider>
        <Layout>
          <Routes>
            <Route path="/project" element={<ProjectsPage />} />
            <Route path="/create" element={<CreateNewPage />} />
            <Route
              path="/project/:projectId"
              element={
                <CurrentProjectProvider>
                  <ProjectViewPage />
                </CurrentProjectProvider>
              }
            />
            <Route path="*" element={<Navigate to="/project" replace />} />
          </Routes>
        </Layout>
      </ProjectsProvider>
      <Toaster />
    </DatabaseProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
