import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, signInAsAnonymous, signOut } from "./firebase";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithGithub: () => Promise<User>;
  signInWithMicrosoft: () => Promise<User>;
  signInWithApple: () => Promise<User>;
  signOut: () => Promise<void>;
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

  const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  };

  const signInWithGithub = async (): Promise<User> => {
    const provider = new GithubAuthProvider();
    provider.addScope("user:email");
    const result = await signInWithPopup(auth, provider);
    return result.user;
  };

  const signInWithMicrosoft = async (): Promise<User> => {
    const provider = new OAuthProvider("microsoft.com");
    provider.addScope("mail.read");
    provider.addScope("calendars.read");
    const result = await signInWithPopup(auth, provider);
    return result.user;
  };

  const signInWithApple = async (): Promise<User> => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    const result = await signInWithPopup(auth, provider);
    return result.user;
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
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
    signInWithApple,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
