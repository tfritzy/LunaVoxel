import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineString } from "firebase-functions/params";
import { createProject } from "./create-project";
import { addToAtlas, deleteAtlasIndex, updateAtlasIndex } from "./update-atlas";
import { syncUser } from "./sync-user";

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

export const healthCheck = onRequest((req, res) => {
  res.status(200).send("Functions are running!");
});

export {
  createProject,
  addToAtlas,
  updateAtlasIndex,
  deleteAtlasIndex,
  syncUser,
};
