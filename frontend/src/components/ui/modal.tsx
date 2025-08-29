import React, { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  maxHeight?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  maxHeight = "90vh",
  footer,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: "w-sm",
    md: "w-md",
    lg: "w-lg",
    xl: "w-xl",
    "2xl": "w-2xl",
    "3xl": "w-3xl",
    "4xl": "w-4xl",
    "5xl": "w-5xl",
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

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-100 transition-opacity duration-200 ease-out ${
        isVisible ? "bg-black/10" : "bg-black/0"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`max-h-[${maxHeight}] ${
          sizeClasses[size]
        } overflow-y-auto transition-opacity duration-200 ease-out ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
        tabIndex={-1}
      >
        <div className="bg-background rounded-lg mx-4 shadow-lg border border-border">
          <div className="pl-6 py-4 pr-2 mb-2">
            <div className="flex items-center justify-between">
              <h2
                id="modal-title"
                className="text-xl font-semibold text-foreground"
              >
                {title}
              </h2>
              <Button
                variant="ghost"
                onClick={handleClose}
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="px-6 pb-6">{children}</div>
          {footer && (
            <div className="flex flex-row justify-between px-4 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
