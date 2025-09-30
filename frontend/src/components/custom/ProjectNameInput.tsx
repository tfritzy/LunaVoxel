import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useCurrentProject } from "@/lib/useCurrentProject";

export function ProjectNameInput() {
  const projectId = useParams<{ projectId: string }>().projectId || "";
  const { connection } = useDatabase();
  const [localName, setLocalName] = useState("");
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const project = useCurrentProject(connection, projectId);

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

  const handleFocus = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  }, []);

  useEffect(() => {
    if (project?.name !== undefined) {
      setLocalName(project.name);
    }
  }, [project?.name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        inputRef.current?.blur();
      } else if (e.key === "Escape") {
        setLocalName(project?.name || "");
        inputRef.current?.blur();
      }
    },
    [project?.name]
  );

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      setLocalName(e.target.value);
    },
    []
  );

  return (
    <input
      ref={inputRef}
      value={localName}
      onChange={handleValueChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className="bg-transparent border-none outline-none text-lg placeholder-foreground-muted font-medium px-3 rounded focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
      placeholder="Untitled Project"
      disabled={
        !project ||
        !connection?.identity ||
        !project.owner.isEqual(connection.identity)
      }
    />
  );
}
