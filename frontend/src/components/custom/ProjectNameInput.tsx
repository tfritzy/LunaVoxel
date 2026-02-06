import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useProject, reducers, useCurrentUserId } from "@/state";

export function ProjectNameInput() {
  const projectId = useParams<{ projectId: string }>().projectId || "";
  const [localName, setLocalName] = useState("");
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const project = useProject(projectId);
  const currentUserId = useCurrentUserId();

  useEffect(() => {
    if (!project || localName === project.name) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (localName.trim() && localName !== project.name) {
        reducers.updateProjectName(projectId!, localName.trim());
      }
    }, 500) as unknown as number;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localName, project, projectId]);

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

  const isOwner = project && currentUserId && project.ownerId === currentUserId;

  return (
    <input
      ref={inputRef}
      value={localName}
      onChange={handleValueChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className="bg-transparent border-none outline-none text-lg placeholder-foreground-muted font-medium px-3 rounded focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
      placeholder="Untitled Project"
      disabled={!project || !isOwner}
    />
  );
}
