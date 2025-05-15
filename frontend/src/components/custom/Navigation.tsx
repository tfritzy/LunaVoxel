import { Link } from "react-router-dom";
import { Home, User, LogOut, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useAuth } from "@/firebase/AuthContext";

export default function Navigation() {
  const { connection } = useDatabase();
  const { currentUser, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const identityDisplay = connection?.identity
    ? `${connection.identity.toHexString().substring(0, 8)}...`
    : "Not connected";

  return (
    <nav className="fixed z-50 top-0 w-full backdrop-brightness-75 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto py-2 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Moon className="h-5 w-5" />
            <span>Lunavox</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {connection && (
            <div className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden md:inline">{identityDisplay}</span>
            </div>
          )}

          {currentUser && !currentUser.isAnonymous && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-sm"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
