import React, { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { EventContext, UserProject } from "@/module_bindings";
import { InviteForm } from "./InviteForm";
import { GeneralAccessRow } from "./GeneralAccessRow";
import { PersonRow } from "./PersonRow";

interface ShareModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const { project } = useCurrentProject();
  const { connection } = useDatabase();
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [showTopBorder, setShowTopBorder] = useState(false);
  const [showBottomBorder, setShowBottomBorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    setShowTopBorder(scrollTop > 0);
    setShowBottomBorder(scrollTop + clientHeight < scrollHeight - 1);
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const checkInitialScroll = () => {
      const { scrollHeight, clientHeight } = element;
      setShowBottomBorder(scrollHeight > clientHeight);
    };

    checkInitialScroll();
    element.addEventListener("scroll", handleScroll);

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [userProjects]);

  useEffect(() => {
    if (!connection?.identity || !project.id) return;

    const userProjectsSub = connection
      .subscriptionBuilder()
      .onApplied(() => {
        const projectUserProjects = Array.from(
          connection.db.userProjects.iter()
        ).filter((up) => up.projectId === project.id);
        setUserProjects(projectUserProjects);
      })
      .onError((error) => {
        console.error("User projects subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM user_projects WHERE ProjectId='${project.id}'`,
      ]);

    const onInsert = (_ctx: EventContext, userProject: UserProject) => {
      if (userProject.projectId === project.id) {
        setUserProjects((prev) => {
          const exists = prev.some((up) => up.email === userProject.email);
          return exists ? prev : [...prev, userProject];
        });
      }
    };

    const onUpdate = (
      _ctx: EventContext,
      oldUserProject: UserProject,
      newUserProject: UserProject
    ) => {
      if (newUserProject.projectId === project.id) {
        setUserProjects((prev) =>
          prev.map((up) =>
            up.email === oldUserProject.email ? newUserProject : up
          )
        );
      }
    };

    const onDelete = (_ctx: EventContext, userProject: UserProject) => {
      if (userProject.projectId === project.id) {
        setUserProjects((prev) =>
          prev.filter((up) => up.email !== userProject.email)
        );
      }
    };

    connection.db.userProjects.onInsert(onInsert);
    connection.db.userProjects.onUpdate(onUpdate);
    connection.db.userProjects.onDelete(onDelete);

    return () => {
      userProjectsSub.unsubscribe();
      connection.db.userProjects.removeOnInsert(onInsert);
      connection.db.userProjects.removeOnUpdate(onUpdate);
      connection.db.userProjects.removeOnDelete(onDelete);
    };
  }, [connection, project.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="max-h-[90vh] w-xl overflow-y-auto">
        <div className="bg-card rounded-lg mx-4 shadow-lg border border-border">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                Share "{project.name}"
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="pl-6">
            <div className="flex flex-row space-x-2 justify-between pr-6 mb-4">
              <InviteForm connection={connection!} projectId={project.id} />
            </div>
            <h3 className="text-sm font-medium text-card-foreground my-4">
              People with access
            </h3>
            <div className="relative">
              {showTopBorder && (
                <div className="absolute top-0 left-0 right-6 h-px bg-border z-10" />
              )}
              <div
                ref={scrollRef}
                className="max-h-72 overflow-y-auto"
                onScroll={handleScroll}
              >
                <div className="space-y-1 pr-6">
                  {userProjects.map((userProject) => (
                    <PersonRow
                      key={userProject.email?.toString()}
                      userProject={userProject}
                      isCurrentUser={userProject.user.isEqual(
                        connection!.identity!
                      )}
                      isOwner={project.owner.isEqual(userProject.user)}
                    />
                  ))}
                </div>
              </div>
              {showBottomBorder && (
                <div className="absolute bottom-0 left-0 right-6 h-px bg-border z-10" />
              )}
            </div>
          </div>
          <div className="px-6 my-4">
            <h3 className="text-sm font-medium text-card-foreground mb-3">
              General access
            </h3>
            <GeneralAccessRow generalAccess={project.generalAccess} />
          </div>
          <div className="p-6 border-t border-border">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
