import * as logger from "firebase-functions/logger";
import { spacetimeUrl } from ".";

export const validateSpacetimeIdentity = async (
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
