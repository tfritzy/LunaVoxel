import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import { Layout } from "./components/custom/Layout";
import { CreateNewPage } from "./components/custom/CreateNewPage";
import { ProjectViewPage } from "./pages/ProjectViewPage";
import { SignInPage } from "./pages/SignInPage";
import { Toaster } from "sonner";
import { ProjectsPage } from "./pages/ProjectsPage";
import { globalStore } from "./state";

function AppContent() {
  const { currentUser, loading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (currentUser) {
      globalStore.setCurrentUserId(currentUser.uid);
    } else {
      globalStore.setCurrentUserId(null);
    }

    setIsReady(true);
  }, [currentUser, authLoading]);

  const isAnonymous = currentUser?.isAnonymous === true;

  if (!isReady || authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (isAnonymous) {
    return (
      <Routes>
        <Route path="/project/:projectId" element={<ProjectViewPage />} />
        <Route path="*" element={<SignInPage />} />
      </Routes>
    );
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="*" element={<SignInPage />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/project" element={<ProjectsPage />} />
        <Route path="/create" element={<CreateNewPage />} />
        <Route path="/project/:projectId" element={<ProjectViewPage />} />
        <Route path="*" element={<Navigate to="/project" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}
