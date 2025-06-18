import { EventContext, Project } from "@/module_bindings";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDatabase } from "./DatabaseContext";

interface ProjectsContextType {
  userProjects: Project[];
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
  const { connection } = useDatabase();

  useEffect(() => {
    if (!connection?.identity) throw "Connection has no identity";
    const myIdentityHex = connection.identity.toHexString();

    connection
      .subscriptionBuilder()
      .onApplied(() => {
        setProjectsLoading(false);
      })
      .onError((error) => {
        console.error("Project subscription error:", error);
      })
      .subscribe([`SELECT * FROM projects WHERE Owner='${myIdentityHex}'`]);

    const onProjectInsert = (ctx: EventContext, row: Project) => {
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
    };

    const onProjectUpdate = (
      ctx: EventContext,
      oldRow: Project,
      newRow: Project
    ) => {
      setUserProjects((prev) =>
        prev.map((p) => (p.id === newRow.id ? newRow : p))
      );
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
    <ProjectsContext.Provider value={{ userProjects: userProjects }}>
      {children}
    </ProjectsContext.Provider>
  );
}
