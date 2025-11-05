import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { userProjects } = useProjects();

  // Navigate to most recent project if available
  useEffect(() => {
    const sortedProjects = userProjects.sort((a, b) => {
      return b.updated.toDate().getTime() - a.updated.toDate().getTime();
    });

    if (sortedProjects.length > 0) {
      navigate(`/project/${sortedProjects[0].id}`);
    } else {
      navigate("/create");
    }
  }, [userProjects, navigate]);

  return null;
}
