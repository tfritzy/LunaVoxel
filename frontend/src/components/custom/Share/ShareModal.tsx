import React, { useEffect, useState, useRef } from "react";
import { Link } from "lucide-react";
import { useCurrentProject } from "@/contexts/CurrentProjectContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { EventContext, UserProject } from "@/module_bindings";
import { InviteForm } from "./InviteForm";
import { GeneralAccessRow } from "./GeneralAccessRow";
import { PersonRow } from "./PersonRow";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const modalContent = (
    <>
      <div className="flex flex-row space-x-2 justify-between mb-4">
        <InviteForm connection={connection!} projectId={project.id} />
      </div>
      <h3 className="text-sm font-medium text-card-foreground my-4">
        People with access
      </h3>
      <div className="relative">
        {showTopBorder && (
          <div className="absolute top-0 left-0 right-0 h-px bg-border z-10" />
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
                isCurrentUser={userProject.user.isEqual(connection!.identity!)}
                isOwner={project.owner.isEqual(userProject.user)}
              />
            ))}
          </div>
        </div>
        {showBottomBorder && (
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border z-10" />
        )}
      </div>
      <div className="my-4">
        <h3 className="text-sm font-medium text-card-foreground mb-3">
          General access
        </h3>
        <GeneralAccessRow project={project} />
      </div>
    </>
  );

  const modalFooter = (
    <>
      <Button size="lg" variant="outline" onClick={handleCopyLink}>
        <Link className="w-4 h-4" />
        <span className="text-sm font-medium">Copy Link</span>
      </Button>
      <Button size="lg" onClick={onClose} variant="outline">
        Done
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${project.name}"`}
      size="xl"
      footer={modalFooter}
    >
      {modalContent}
    </Modal>
  );
};
