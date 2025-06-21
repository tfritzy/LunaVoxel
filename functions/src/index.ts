import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";

setGlobalOptions({ region: "us-central1" });

initializeApp();

const spacetimeUrl = defineString("SPACETIME_URL", {
  default: "localhost:3000",
});

const hostSpacetimeToken = defineString("SPACETIME_TOKEN", {
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

const validateSpacetimeIdentity = async (
  identity: string,
  token: string
): Promise<boolean> => {
  try {
    const spacetimeHost = spacetimeUrl.value();
    const isDev = spacetimeHost.includes("localhost");
    const protocol = isDev ? "http" : "https";
    const url = `${protocol}://${spacetimeHost}/v1/identity/${identity}/verify`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    logger.info(
      `SpacetimeDB identity verification response: ${response.status} ${response.statusText}`
    );

    if (response.status === 204) {
      logger.info(
        `SpacetimeDB identity verification successful for ${identity}`
      );
      return true;
    } else if (response.status === 400) {
      logger.error(
        `SpacetimeDB identity verification failed: Token valid but doesn't match identity ${identity}`
      );
      const responseText = await response.text();
      logger.error(`Response body: ${responseText}`);
      return false;
    } else if (response.status === 401) {
      logger.error(
        `SpacetimeDB identity verification failed: Invalid token for identity ${identity}`
      );
      const responseText = await response.text();
      logger.error(`Response body: ${responseText}`);
      return false;
    } else {
      logger.error(
        `SpacetimeDB identity verification failed: Unexpected status ${response.status} for identity ${identity}`
      );
      const responseText = await response.text();
      logger.error(`Response body: ${responseText}`);
      return false;
    }
  } catch (error) {
    logger.error("Error validating SpacetimeDB identity:", error);
    return false;
  }
};

export const syncUser = onCall<SyncUserRequest, Promise<SyncUserResponse>>(
  async (request) => {
    const {
      idToken,
      identity,
      spacetimeToken: userSpacetimeToken,
    } = request.data;

    if (!idToken) {
      throw new Error("ID token is required");
    }

    if (!identity) {
      throw new Error("SpacetimeDB identity is required");
    }

    if (!userSpacetimeToken) {
      throw new Error("SpacetimeDB token is required");
    }

    const isValidIdentity = await validateSpacetimeIdentity(
      identity,
      userSpacetimeToken
    );
    if (!isValidIdentity) {
      throw new Error("Invalid SpacetimeDB identity or token");
    }

    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    logger.info(
      `Syncing user: ${uid}, email: ${email}, spacetime identity: ${identity}`
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const cloudFunctionToken = hostSpacetimeToken.value();
    if (cloudFunctionToken) {
      headers["Authorization"] = `Bearer ${cloudFunctionToken}`;
    }

    const spacetimeHost = spacetimeUrl.value();
    const isDev = spacetimeHost.includes("localhost");
    const protocol = isDev ? "http" : "https";

    const response = await fetch(
      `${protocol}://${spacetimeHost}/v1/database/lunavoxel/call/SyncUser`,
      {
        method: "POST",
        headers,
        body: JSON.stringify([identity, email || "", name || ""]),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("SpacetimeDB sync failed:", errorText);
      throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
    }

    return { success: true, uid };
  }
);

export const healthCheck = onRequest((req, res) => {
  res.status(200).send("Functions are running!");
});
