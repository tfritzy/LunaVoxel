import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  blocksUsingSlot: number;
}

export const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  isSubmitting,
  blocksUsingSlot,
}: DeleteConfirmationModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Confirm Delete"
      footer={
        <div className="flex items-center w-full justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            pending={isSubmitting}
          >
            <Trash className="h-4 w-4" />
            Delete
          </Button>
        </div>
      }
    >
      <div className="flex flex-col min-h-0">
        <div className="flex-1">
          <p className="text-sm text-foreground mb-4">
            Are you sure you want to delete this atlas slot? This action cannot
            be undone.
          </p>
          {blocksUsingSlot > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive font-medium">
                Warning: This slot is currently used by {blocksUsingSlot} block
                {blocksUsingSlot === 1 ? "" : "s"}.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
