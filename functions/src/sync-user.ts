import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
  uid: string;
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
        throw new HttpsError("invalid-argument", "Invalid SpaceTime identity");
      }

      await callSpacetimeDB("/v1/database/lunavoxel-db/call/SyncUser", "POST", [
        identity,
        decodedToken.email || "",
        decodedToken.name || "",
      ]);

      return { uid };
    } catch (error) {
      logger.error("Error in syncUser:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);
