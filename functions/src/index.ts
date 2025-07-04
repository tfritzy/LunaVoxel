import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";
import { createProject } from "./create-project";
import { validateSpacetimeIdentity } from "./identity-validation";
import { addToAtlas, updateAtlasIndex } from "./update-atlas";

setGlobalOptions({ region: "us-central1" });

export const adminApp = initializeApp();

if (process.env.FUNCTIONS_EMULATOR === "true") {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
}

setGlobalOptions({
  region: "us-central1",
});

export const spacetimeUrl = defineString("SPACETIME_URL", {
  default: "localhost:3000",
});

export const hostSpacetimeToken = defineString("SPACETIME_TOKEN", {
  default: "",
});

interface SyncUserRequest {
  idToken: string;
  identity: string;
  spacetimeToken: string;
}

interface SyncUserResponse {
  success: boolean;
  uid?: string;
  error?: string;
}

export const syncUser = onCall<SyncUserRequest, Promise<SyncUserResponse>>(
  async (request) => {
    const { idToken, identity, spacetimeToken } = request.data;

    try {
      const decodedToken = await getAuth(adminApp).verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const isValidIdentity = await validateSpacetimeIdentity(
        identity,
        spacetimeToken
      );

      if (!isValidIdentity) {
        return {
          success: false,
          error: "Invalid SpaceTime identity",
        };
      }

      const spacetimeHost = spacetimeUrl.value();
      const isDev = spacetimeHost.includes("localhost");
      const protocol = isDev ? "http" : "https";
      const cloudFunctionToken = hostSpacetimeToken.value();

      const response = await fetch(
        `${protocol}://${spacetimeHost}/v1/database/lunavoxel/call/SyncUser`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cloudFunctionToken}`,
          },
          body: JSON.stringify([
            identity,
            decodedToken.email || "",
            decodedToken.name || "",
          ]),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("SpacetimeDB sync failed:", errorText);
        throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
      }

      return {
        success: true,
        uid,
      };
    } catch (error) {
      logger.error("Error in syncUser:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

export const healthCheck = onRequest((req, res) => {
  res.status(200).send("Functions are running!");
});

export { createProject, addToAtlas, updateAtlasIndex };
