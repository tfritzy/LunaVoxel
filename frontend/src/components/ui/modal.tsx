import React from "react";

const DesktopModal = (props: ModalProps) => {
  return (
    <div
      className={`fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 backdrop-blur-lg backdrop-brightness-75 rounded-lg shadow-lg drop-shadow-xl max-w-11/12 max-h-3/4 w-screen transition-transform duration-300 ${
        props.isOpen
          ? "scale-100 opacity-100 pointer-events-auto"
          : "scale-95 opacity-0 pointer-events-none"
      }`}
    >
      <div className="">{props.children}</div>
    </div>
  );
};

const MobileModal = (props: ModalProps) => {
  return (
    <div
      className={`fixed bottom-0 left-0 w-screen transform backdrop-blur-lg backdrop-brightness-75 rounded transition-transform duration-300 ${
        props.isOpen
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-full opacity-0 pointer-events-none"
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
  const isMobile = window.innerWidth < 640;

  return (
    <div
      onClick={props.onClose}
      className="fixed left-0 top-0 w-full h-full bg-[#00000022] z-50"
      style={{ pointerEvents: props.isOpen ? "all" : "none" }}
    >
      <div onClick={(event) => event.stopPropagation()}>
        {isMobile ? <MobileModal {...props} /> : <DesktopModal {...props} />}
      </div>
    </div>
  );
};
