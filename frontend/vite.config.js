import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "app.html"),
      },
    },
  },
  publicDir: "public",
  server: {
    historyApiFallback: {
      rewrites: [
        { from: /^\/projects/, to: "/app.html" },
        { from: /^\/worlds/, to: "/app.html" },
        { from: /^\/$/, to: "/index.html" },
      ],
    },
  },
});
