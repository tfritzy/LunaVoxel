import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserProjects } from "@/state";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { userProjects } = useUserProjects();

  useEffect(() => {
    const sortedProjects = [...userProjects].sort((a, b) => {
      return b.updated - a.updated;
    });

    if (sortedProjects.length > 0) {
      navigate(`/project/${sortedProjects[0].id}`);
    } else {
      navigate("/create");
    }
  }, [userProjects, navigate]);

  return null;
}
