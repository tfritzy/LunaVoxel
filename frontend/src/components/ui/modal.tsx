import React from "react";

const DesktopModal = (props: ModalProps) => {
  return (
    <div
      className={`fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 backdrop-blur-xl backdrop-brightness-60 rounded-lg shadow-lg drop-shadow-xl max-w-11/12 max-h-3/4 w-screen transition-transform duration-300 ${
        props.isOpen
          ? "scale-100 opacity-100 pointer-events-auto"
          : "scale-95 opacity-0 pointer-events-none"
      }`}
    >
      <div className="">{props.children}</div>
    </div>
  );
};

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export const Modal = (props: ModalProps) => {
  return (
    <div
      onClick={props.onClose}
      className="fixed left-0 top-0 w-full h-full bg-[#00000022] z-50"
      style={{ pointerEvents: props.isOpen ? "all" : "none" }}
    >
      <div onClick={(event) => event.stopPropagation()}>
        <DesktopModal {...props} />
      </div>
    </div>
  );
};
