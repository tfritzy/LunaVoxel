import React, { createContext, useContext } from "react";

type Modal = "block-modal" | "atlas-modal" | "project-modal";
type RightSideDrawer = "atlas-drawer";

interface DialogContextType {
  modal: Modal | null;
  rightSideDrawer: RightSideDrawer | null;
  setModal: (modal: Modal | null) => void;
  setRightSideDrawer: (drawer: RightSideDrawer | null) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialogs() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = React.useState<Modal | null>(null);
  const [rightSideDrawer, setRightSideDrawer] =
    React.useState<RightSideDrawer | null>(null);

  return (
    <DialogContext.Provider
      value={{
        modal,
        rightSideDrawer,
        setModal,
        setRightSideDrawer,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}
