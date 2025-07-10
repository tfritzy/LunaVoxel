import { getAuth } from "firebase-admin/auth";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { adminApp } from "./index";
import { validateSpacetimeIdentity } from "./identity-validation";
import { callSpacetimeDB } from "./spacetime-client";

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

      await callSpacetimeDB("/v1/database/lunavoxel/call/SyncUser", "POST", [
        identity,
        decodedToken.email || "",
        decodedToken.name || "",
      ]);

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
