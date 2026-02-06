import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/custom/Layout";
import { ProjectViewPage } from "./pages/ProjectViewPage";
import { Toaster } from "sonner";
export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ProjectViewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster />
    </BrowserRouter>
  );
}
