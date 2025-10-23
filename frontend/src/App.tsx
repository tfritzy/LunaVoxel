import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { DbConnection, ErrorContext, Vector3 } from "./module_bindings";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import { DatabaseProvider } from "./contexts/DatabaseContext";
import { Layout } from "./components/custom/Layout";
import { CreateNewPage } from "./components/custom/CreateNewPage";
import { ProjectViewPage } from "./pages/ProjectViewPage";
import { SignInPage } from "./pages/SignInPage";
import { Toaster } from "sonner";
import { ProjectsPage } from "./pages/ProjectsPage";
import { Identity } from "spacetimedb";
import { translateVector3ArrayUp } from "./lib/wasm-helpers";

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

const positions: Vector3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 1 },
  { x: 2, y: 2, z: 2 },
];

function AppContent() {
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [userSynced, setUserSynced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { currentUser } = useAuth();

useEffect(() => {
  const loadTranslations = async () => {
    const translated = await translateVector3ArrayUp(positions, 5.0); 
    console.log("translated", translated);
  };
  
  loadTranslations();
}, []);

  const syncUserWithCloudFunction = useCallback(
    async (idToken: string, identity: Identity, spacetimeToken: string) => {
      try {
        const functions = getFunctions();
        const syncUser = httpsCallable<SyncUserRequest, SyncUserResult>(
          functions,
          "syncUser"
        );

        await syncUser({
          idToken,
          identity: identity.toHexString(),
          spacetimeToken,
        });

        setUserSynced(true);
        return true;
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

      setIsConnecting(false);

      if (currentUser && !userSynced && !currentUser.isAnonymous) {
        localStorage.setItem("auth_token", token);
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
    setIsConnecting(false);
  }, []);

  const handleConnectError = useCallback((_ctx: ErrorContext, err: Error) => {
    console.log("Error connecting to SpacetimeDB:", err);
    setConn(null);
    setIsConnecting(false);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const connectToSpaceTime = async () => {
      try {
        setIsConnecting(true);
        setConn(null);
        setUserSynced(false);

        const idToken = await currentUser.getIdToken();
        const config = getSpacetimeConfig();

        DbConnection.builder()
          .withUri(config.uri)
          .withModuleName("lunavoxel-db")
          .withToken(idToken || "")
          .onConnect(handleConnect)
          .onDisconnect(handleDisconnect)
          .onConnectError(handleConnectError)
          .build();
      } catch (err) {
        console.error("Error initializing connection:", err);
        setIsConnecting(false);
      }
    };

    connectToSpaceTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const isAnonymous = currentUser?.isAnonymous === true;

  if (isAnonymous) {
    return (
      <DatabaseProvider connection={conn}>
        <Routes>
          <Route path="/project/:projectId" element={<ProjectViewPage />} />
          <Route path="*" element={<SignInPage />} />
        </Routes>
      </DatabaseProvider>
    );
  }

  if (!conn || isConnecting) return null;

  return (
    <DatabaseProvider connection={conn}>
      <Layout>
        <Routes>
          <Route path="/project" element={<ProjectsPage />} />
          <Route path="/create" element={<CreateNewPage />} />
          <Route path="/project/:projectId" element={<ProjectViewPage />} />
          <Route path="*" element={<Navigate to="/project" replace />} />
        </Routes>
      </Layout>
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