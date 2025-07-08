import React, { useEffect, useRef } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  disableOutsideClick?: boolean;
};

export const Modal = ({
  isOpen,
  onClose,
  children,
  disableOutsideClick = false,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (dialogNode) {
      if (isOpen) {
        dialogNode.showModal();
      } else {
        dialogNode.close();
      }
    }
  }, [isOpen]);

  const handleOutsideClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (disableOutsideClick) return;

    const dialogNode = dialogRef.current;
    if (dialogNode && event.target === dialogNode) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleOutsideClick}
      className="bg-background border border-border rounded-lg shadow-lg m-auto backdrop:bg-black backdrop:opacity-20"
    >
      <div>{children}</div>
    </dialog>
  );
};
