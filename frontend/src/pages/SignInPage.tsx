import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/firebase/AuthContext";
import { createProject } from "@/lib/createProject";
import { SignInModal } from "@/components/custom/SignInModal";

export const SignInPage = () => {
  const {
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
  } = useAuth();
  const navigate = useNavigate();

  const handleProviderSignIn = useCallback(
    async (provider: "google" | "github" | "microsoft" | "apple") => {
      try {
        let user;
        switch (provider) {
          case "google":
            user = await signInWithGoogle();
            break;
          case "github":
            user = await signInWithGithub();
            break;
          case "microsoft":
            user = await signInWithMicrosoft();
            break;
        }

        if (user) {
          await createProject(navigate);
        }
      } catch (error) {
        console.error(`Error signing in with ${provider}:`, error);
      }
    },
    [signInWithGoogle, signInWithGithub, signInWithMicrosoft, navigate]
  );

  const handleSignIn = useCallback(async () => {
    await createProject(navigate);
  }, [navigate]);

  return (
    <div className="w-full h-screen bg-background flex items-center justify-center">
      <SignInModal
        title="Welcome to LunaVoxel"
        subheader="Sign in to create and edit projects"
        onSignIn={handleSignIn}
      />
    </div>
  );
};