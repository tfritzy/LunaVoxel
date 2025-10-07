import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInWithPopup,
  AuthError,
} from "firebase/auth";
import { auth, signInAsAnonymous, signOut } from "./firebase";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<User>;
  signInWithGithub: () => Promise<User>;
  signInWithMicrosoft: () => Promise<User>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const signInWithGoogle = async (): Promise<User> => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        const authError = error as AuthError;
        if (
          authError.code === "auth/account-exists-with-different-credential"
        ) {
          setError(
            "An account already exists with this email address. Please sign in with the provider you originally used."
          );
          throw new Error(
            "An account already exists with this email address. Please sign in with the provider you originally used."
          );
        }
      }
      setError(
        error instanceof Error ? error.message : "Failed to sign in with Google"
      );
      throw error;
    }
  };

  const signInWithGithub = async (): Promise<User> => {
    setError(null);
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        const authError = error as AuthError;
        if (
          authError.code === "auth/account-exists-with-different-credential"
        ) {
          setError(
            "An account already exists with this email address. Please sign in with the provider you originally used."
          );
          throw new Error(
            "An account already exists with this email address. Please sign in with the provider you originally used."
          );
        }
      }
      setError(
        error instanceof Error ? error.message : "Failed to sign in with GitHub"
      );
      throw error;
    }
  };

  const signInWithMicrosoft = async (): Promise<User> => {
    setError(null);
    try {
      const provider = new OAuthProvider("microsoft.com");
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        const authError = error as AuthError;
        if (
          authError.code === "auth/account-exists-with-different-credential"
        ) {
          setError(
            "An account already exists with this email address. Please sign in with the provider you originally used."
          );
          throw new Error(
            "An account already exists with this email address. Please sign in with the provider you originally used."
          );
        }
      }
      setError(
        error instanceof Error
          ? error.message
          : "Failed to sign in with Microsoft"
      );
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        try {
          await signInAsAnonymous();
        } catch (error) {
          console.error("Error during automatic anonymous sign-in:", error);
          setLoading(false);
        }
      } else {
        setCurrentUser(user);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    error,
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
    signOut,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
