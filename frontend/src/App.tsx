import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/custom/Layout";
import { CreateNewPage } from "./components/custom/CreateNewPage";
import { ProjectViewPage } from "./pages/ProjectViewPage";
import { Toaster } from "sonner";
import { ProjectsPage } from "./pages/ProjectsPage";
import { globalStore } from "./state";

function AppContent() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    globalStore.setCurrentUserId("local-user");
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/project" element={<ProjectsPage />} />
        <Route path="/create" element={<CreateNewPage />} />
        <Route path="/project/:projectId" element={<ProjectViewPage />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster />
    </BrowserRouter>
  );
}
