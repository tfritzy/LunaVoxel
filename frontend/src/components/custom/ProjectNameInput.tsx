import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { EventContext, Project } from "@/module_bindings";
import { useDatabase } from "@/contexts/DatabaseContext";

export function ProjectNameInput() {
  const { projectId } = useParams<{ projectId: string }>();
  const { connection } = useDatabase();
  const [localName, setLocalName] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId || !connection) return;

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const projectData = connection.db.projects.id.find(projectId);
        if (projectData) {
          setProject(projectData);
          setLocalName(projectData.name || "");
        }
      })
      .onError((error) => {
        console.error("Project subscription error:", error);
      })
      .subscribe([`SELECT * FROM projects WHERE Id='${projectId}'`]);

    const onProjectUpdate = (
      ctx: EventContext,
      oldProject: Project,
      newProject: Project
    ) => {
      if (newProject.id === projectId) {
        setProject(newProject);
        setLocalName(newProject.name);
      }
    };

    connection.db.projects.onUpdate(onProjectUpdate);

    return () => {
      connection.db.projects.removeOnUpdate(onProjectUpdate);
      subscription.unsubscribe();
    };
  }, [projectId, connection]);

  useEffect(() => {
    if (!project || localName === project.name) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (localName.trim() && localName !== project.name) {
        connection?.reducers.updateProjectName(projectId!, localName.trim());
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localName, project, projectId, connection]);

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setLocalName(project?.name || "");
      inputRef.current?.blur();
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setLocalName(e.target.value);
  };

  if (!project) {
    return <div />;
  }

  return (
    <input
      ref={inputRef}
      value={localName}
      onChange={handleValueChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className="bg-transparent border-none outline-none text-lg font-medium px-3 rounded focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
      placeholder="Untitled Project"
    />
  );
}
