import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingActionBarProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const PendingActionBar = ({
  onConfirm,
  onCancel,
}: PendingActionBarProps) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-background/90 border border-secondary rounded-md px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="text-sm text-muted-foreground mr-1">
          Resize handles or
        </span>
        <Button
          onClick={onConfirm}
          className="h-7 px-3 bg-green-600 hover:bg-green-500 text-white text-sm gap-1"
          title="Confirm (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
          Confirm
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="h-7 px-3 text-sm gap-1 text-muted-foreground hover:text-destructive"
          title="Cancel (Escape)"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
};
