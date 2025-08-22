import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as FirebaseUser } from "firebase/auth";
import { Avatar } from "../Avatar";
import { generateDisplayName } from "@/lib/nameGenerator";
import { useState } from "react";

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
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!currentUser) {
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

  if (currentUser.isAnonymous) {
    const displayName = generateDisplayName(currentUser.uid);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="border-2 rounded-full border-border hover:border-accent hover:brightness-125 transition-colors">
            <Avatar id={currentUser.uid} displayName={displayName} size={36} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onSignIn}
            className="flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Sign In
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="border-2 rounded-full border-border hover:border-accent hover:brightness-125 transition-colors">
          <div className="w-9 h-9 rounded-full relative overflow-hidden">
            {currentUser.photoURL && !imageError ? (
              <>
                {!imageLoaded && (
                  <div className="w-full h-full bg-muted animate-pulse" />
                )}
                <img
                  src={currentUser.photoURL}
                  alt=""
                  className={`w-full h-full rounded-full object-cover transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </>
            ) : (
              <Avatar
                id={currentUser.uid}
                displayName={currentUser.email || currentUser.uid}
                size={36}
              />
            )}
          </div>
        </button>
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