import { AccessType } from "@/module_bindings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

const getRoleLabel = (role: AccessType["tag"]) => {
  switch (role) {
    case AccessType.ReadWrite.tag:
      return "Editor";
    case AccessType.Read.tag:
      return "Viewer";
    default:
      return "Viewer";
  }
};

export function RoleDropdown({
  disabled,
  role,
  onRoleChange,
  allowRemove,
  onRemove,
}: {
  disabled: boolean;
  role: AccessType["tag"];
  onRoleChange: (role: AccessType["tag"]) => void;
  allowRemove: boolean;
  onRemove?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors border border-input",
          disabled
            ? "text-muted-foreground cursor-default"
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {getRoleLabel(role)}
        {!disabled && <ChevronDown className="w-4 h-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onRoleChange("ReadWrite")}>
          {role === "ReadWrite" ? (
            <Check />
          ) : (
            <span className="w-4">&nbsp;</span>
          )}
          <div className="flex-1 text-left">Editor</div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRoleChange("Read")}>
          {role === "Read" ? <Check /> : <span className="w-4">&nbsp;</span>}
          <div className="flex-1 text-left">Viewer</div>
        </DropdownMenuItem>
        {allowRemove && <DropdownMenuSeparator />}
        {allowRemove && (
          <DropdownMenuItem onClick={() => onRemove?.()}>
            Remove access
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
