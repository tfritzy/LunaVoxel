import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./globals.css";
import { initWasm } from "./lib/wasmInit";

const rootElement = document.getElementById("root");

async function initializeApp() {
  if (!rootElement) {
    console.error("Root element not found");
    return;
  }

  try {
    // Initialize WASM before rendering the app
    await initWasm();

    ReactDOM.createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("Failed to initialize application:", error);
  }
}

initializeApp();
