import { spacetimeUrl, hostSpacetimeToken } from "./index";
import * as logger from "firebase-functions/logger";

export const callSpacetimeDB = async (
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
  body?: unknown,
  senderToken?: string
): Promise<Response> => {
  const spacetimeHost = spacetimeUrl.value();
  const isDev = spacetimeHost.includes("localhost");
  const protocol = isDev ? "http" : "https";
  const cloudFunctionToken = hostSpacetimeToken.value();

  const url = `${protocol}://${spacetimeHost}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${senderToken || cloudFunctionToken}`,
    },
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`SpacetimeDB ${method} ${endpoint} failed:`, errorText);
    throw new Error(`SpacetimeDB error: ${response.status} ${errorText}`);
  }

  return response;
};
