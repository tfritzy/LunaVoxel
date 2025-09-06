import { Atlas } from "@/module_bindings";
import React, { createContext, useContext, useMemo } from "react";
import { useParams } from "react-router-dom";
import { AtlasSlot, useAtlas } from "@/lib/useAtlas";
import * as THREE from "three";

interface AtlasContextType {
  atlas: Atlas;
  atlasSlots: AtlasSlot[];
  textureAtlas: THREE.Texture | null;
}

const AtlasContext = createContext<AtlasContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAtlasContext = () => {
  const ctx = useContext(AtlasContext);
  if (!ctx)
    throw new Error(
      "useAtlasContext must be used within CurrentProjectProvider"
    );
  return ctx;
};

export const CurrentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const { atlas, slots, texture } = useAtlas(projectId || "");

  const atlasValue = useMemo<AtlasContextType | undefined>(
    () => ({ atlas: atlas!, atlasSlots: slots, textureAtlas: texture }),
    [atlas, slots, texture]
  );

  return (
    <AtlasContext.Provider value={atlasValue}>{children}</AtlasContext.Provider>
  );
};

// const NotFoundState = ({
//   retryProjectLoad,
// }: {
//   retryProjectLoad: () => void;
// }) => {
//   const { currentUser, signInWithGoogle } = useAuth();

//   const handleSignIn = async () => {
//     try {
//       await signInWithGoogle();
//       setTimeout(() => {
//         retryProjectLoad();
//       }, 1000);
//     } catch (error) {
//       console.error("Error signing in:", error);
//     }
//   };

//   return (
//     <div className="h-screen flex items-center justify-center bg-background">
//       <div className="bg-card p-8 rounded-lg shadow-lg max-w-md text-center border">
//         <div className="w-16 h-16 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
//           <svg
//             className="w-8 h-8 text-muted-foreground"
//             fill="none"
//             stroke="currentColor"
//             viewBox="0 0 24 24"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               strokeWidth={2}
//               d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
//             />
//           </svg>
//         </div>

//         <h2 className="text-xl font-semibold mb-3">Project Not Found</h2>

//         <p className="text-muted-foreground mb-6">
//           This project either doesn't exist or you don't have access to it.
//           {currentUser?.isAnonymous &&
//             " You may need to sign in to view this project."}
//         </p>

//         <div className="space-y-3">
//           {currentUser?.isAnonymous && (
//             <Button onClick={handleSignIn} className="w-full">
//               Sign In with Google
//             </Button>
//           )}
//           <Button
//             onClick={retryProjectLoad}
//             variant="outline"
//             className="w-full"
//           >
//             Try Again
//           </Button>
//           <p className="text-sm text-muted-foreground">
//             Make sure you have access to this project or check that the link is
//             correct
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };
