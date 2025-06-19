import { EventContext, Project } from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";

interface ProjectsContextType {
  userProjects: Project[];
  sharedProjects: Project[];
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(
  undefined
);

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const { connection } = useDatabase();

  useEffect(() => {
    if (!connection?.identity) throw "Connection has no identity";

    connection
      .subscriptionBuilder()
      .onApplied(() => {
        setProjectsLoading(false);
      })
      .onError((error) => {
        console.error("Project subscription error:", error);
      })
      .subscribe([`SELECT * FROM projects`]);

    const onProjectInsert = (ctx: EventContext, row: Project) => {
      const isUserProject =
        connection.identity && row.owner.isEqual(connection.identity);

      if (isUserProject) {
        setUserProjects((prev) => {
          const existingIndex = prev.findIndex(
            (existing) => existing.id === row.id
          );
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = row;
            return updated;
          } else {
            return [...prev, row];
          }
        });
      } else {
        setSharedProjects((prev) => {
          const existingIndex = prev.findIndex(
            (existing) => existing.id === row.id
          );
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = row;
            return updated;
          } else {
            return [...prev, row];
          }
        });
      }
    };

    const onProjectUpdate = (
      ctx: EventContext,
      oldRow: Project,
      newRow: Project
    ) => {
      const isUserProject =
        connection.identity && newRow.owner.isEqual(connection.identity);

      if (isUserProject) {
        setUserProjects((prev) =>
          prev.map((p) => (p.id === newRow.id ? newRow : p))
        );
        setSharedProjects((prev) => prev.filter((p) => p.id !== newRow.id));
      } else {
        setSharedProjects((prev) =>
          prev.map((p) => (p.id === newRow.id ? newRow : p))
        );
        setUserProjects((prev) => prev.filter((p) => p.id !== newRow.id));
      }
    };

    connection.db.projects.onInsert(onProjectInsert);
    connection.db.projects.onUpdate(onProjectUpdate);

    return () => {
      connection.db.projects.removeOnInsert(onProjectInsert);
      connection.db.projects.removeOnUpdate(onProjectUpdate);
    };
  }, [connection]);

  if (projectsLoading) return null;

  return (
    <ProjectsContext.Provider value={{ userProjects, sharedProjects }}>
      {children}
    </ProjectsContext.Provider>
  );
}
