import React, { useEffect, useState, useRef } from "react";
import { Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { useProject } from "@/state";

interface ShareModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const projectId = useParams().projectId || "";
  const [showTopBorder, setShowTopBorder] = useState(false);
  const [showBottomBorder, setShowBottomBorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const project = useProject(projectId);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/project/${projectId}`;
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
  }, []);

  if (!project) return null;

  const modalContent = (
    <div className="px-6 py-4">
      <div className="flex flex-row space-x-2 justify-between mb-4">
        <p className="text-muted-foreground">
          Sharing is currently disabled in client-side mode.
        </p>
      </div>
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
            <p className="text-sm text-muted-foreground">
              This project is stored locally in your browser.
            </p>
          </div>
        </div>
        {showBottomBorder && (
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border z-10" />
        )}
      </div>
    </div>
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
