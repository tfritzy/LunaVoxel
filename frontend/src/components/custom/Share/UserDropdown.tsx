import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as FirebaseUser } from "firebase/auth";

interface UserDropdownProps {
  currentUser: FirebaseUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function UserDropdown({
  currentUser,
  onSignIn,
  onSignOut,
}: UserDropdownProps) {
  if (!currentUser || currentUser.isAnonymous) {
    return (
      <Button
        onClick={onSignIn}
        variant="ghost"
        className="flex items-center gap-2"
      >
        <User className="w-4 h-4" />
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-2 border-2 rounded-full border-border hover:border-accent hover:brightness-125">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Profile"
              className="w-9 h-9 rounded-full"
            />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={onSignOut}
          className="flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
