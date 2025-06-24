import React, { useEffect, useState, useRef } from "react";
import { Link, X } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { EventContext, UserProject } from "@/module_bindings";
import { InviteForm } from "./InviteForm";
import { GeneralAccessRow } from "./GeneralAccessRow";
import { PersonRow } from "./PersonRow";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/project/${project.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    setShowTopBorder(scrollTop > 0);
    setShowBottomBorder(scrollTop + clientHeight < scrollHeight - 1);
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShouldRender(false);
      onClose();
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      if (modalRef.current) {
        modalRef.current.focus();
      }
    } else {
      setIsVisible(false);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";

      setTimeout(() => {
        setShouldRender(false);
      }, 200);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
        )
          .filter((up) => up.projectId === project.id)
          .filter((up) => up.accessType.tag !== "Inherited");
        setUserProjects(projectUserProjects);
      })
      .onError((error) => {
        console.error("User projects subscription error:", error);
      })
      .subscribe([
        `SELECT * FROM user_projects WHERE ProjectId='${project.id}'`,
      ]);

    const onInsert = (_ctx: EventContext, userProject: UserProject) => {
      if (
        userProject.projectId === project.id &&
        userProject.accessType.tag !== "Inherited"
      ) {
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
        if (newUserProject.accessType.tag !== "Inherited") {
          setUserProjects((prev) =>
            prev.map((up) =>
              up.email === oldUserProject.email ? newUserProject : up
            )
          );
        } else {
          // Remove from list if access type changed to inherited
          setUserProjects((prev) =>
            prev.filter((up) => up.email !== oldUserProject.email)
          );
        }
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

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-200 ease-out ${
        isVisible ? "bg-black/10" : "bg-black/0"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        ref={modalRef}
        className={`max-h-[90vh] w-xl overflow-y-auto transition-all duration-200 ease-out ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
        tabIndex={-1}
      >
        <div className="bg-background rounded-lg mx-4 shadow-lg border border-border">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h2
                id="share-modal-title"
                className="text-lg font-semibold text-foreground"
              >
                Share "{project.name}"
              </h2>
              <Button
                variant="ghost"
                onClick={handleClose}
                aria-label="Close share dialog"
              >
                <X className="w-5 h-5" />
              </Button>
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
                <div className="space-y-1 pr-6 pl-2">
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
            <GeneralAccessRow project={project} />
          </div>
          <div className="flex flex-row justify-between p-6 border-t border-border">
            <Button size="lg" variant="outline" onClick={handleCopyLink}>
              <Link className="w-4 h-4" />
              <span className="text-sm font-medium">Copy Link</span>
            </Button>
            <Button size="lg" onClick={handleClose} variant="outline">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
