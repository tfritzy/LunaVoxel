import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateWorldButtonProps {
  onClick: () => void;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  children?: React.ReactNode;
}

export default function CreateWorldButton({
  onClick,
  variant = "default",
  className,
  children,
}: CreateWorldButtonProps) {
  return (
    <Button onClick={onClick} variant={variant} className={className}>
      <Plus className="h-4 w-4" />
      {children || "Create new"}
    </Button>
  );
}
