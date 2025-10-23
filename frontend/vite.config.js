import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function spaFallbackPlugin() {
  return {
    name: "spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        if (url === "/" || url === "/index.html") {
          req.url = "/index.html";
        } else if (
          url.startsWith("/project") ||
          url.startsWith("/project") ||
          url.startsWith("/create-new")
        ) {
          req.url = "/app.html";
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallbackPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "app.html"),
        index: path.resolve(__dirname, "index.html"),
      },
    },
  },
  publicDir: "public",
  appType: "spa",
  server: {
    open: "/",
  },
  assetsInclude: ["**/*.wasm"],
});