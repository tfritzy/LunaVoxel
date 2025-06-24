import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./globals.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
} else {
  console.error("Root element not found");
}
