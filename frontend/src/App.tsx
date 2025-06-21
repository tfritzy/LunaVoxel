import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { DbConnection, ErrorContext } from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import { DatabaseProvider } from "./contexts/DatabaseContext";
import { Layout } from "./components/custom/Layout";
import { ProjectsProvider } from "./contexts/ProjectsContext";
import { CurrentProjectProvider } from "./contexts/CurrentProjectContext";
import { ProjectsPage } from "./pages/ProjectsPage";
import { CreateNewPage } from "./components/custom/CreateNewPage";
import { ProjectViewPage } from "./pages/ProjectViewPage";

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

  const syncUserWithCloudFunction = async (
    idToken: string,
    identity: Identity,
    spacetimeToken: string
  ) => {
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
        console.log("User synced successfully:", result.data.uid);
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
  };

  useEffect(() => {
    const onConnect = async (
      connection: DbConnection,
      identity: Identity,
      token: string
    ) => {
      setConn(connection);
      localStorage.setItem("auth_token", token);

      if (currentUser && !userSynced) {
        const idToken = await currentUser.getIdToken();
        await syncUserWithCloudFunction(idToken, identity, token);
      }
    };

    const onDisconnect = () => {
      console.log("Disconnected from SpacetimeDB");
      setConn(null);
      setUserSynced(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log("Error connecting to SpacetimeDB:", err);
      setConn(null);
    };

    const connectToSpaceTime = async () => {
      if (!currentUser) return;

      try {
        const idToken = await currentUser.getIdToken();
        const config = getSpacetimeConfig();

        console.log("Connecting to SpacetimeDB:", config);

        DbConnection.builder()
          .withUri(config.uri)
          .withModuleName("lunavoxel")
          .withToken(idToken || localStorage.getItem("auth_token") || "")
          .onConnect(onConnect)
          .onDisconnect(onDisconnect)
          .onConnectError(onConnectError)
          .build();
      } catch (err) {
        console.error("Error initializing connection:", err);
      }
    };

    connectToSpaceTime();
  }, [currentUser, userSynced]);

  if (!conn) return null;

  return (
    <DatabaseProvider connection={conn}>
      <ProjectsProvider>
        <Layout>
          <Routes>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/create-new" element={<CreateNewPage />} />
            <Route
              path="/project/:projectId"
              element={
                <CurrentProjectProvider>
                  <ProjectViewPage />
                </CurrentProjectProvider>
              }
            />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </Layout>
      </ProjectsProvider>
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
