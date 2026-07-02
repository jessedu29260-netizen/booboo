import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Standalone panel APP build (distinct from the tsup library build). Bundles
// React + the panel into self-contained static assets that `booboo panel`
// serves locally — mirrors the viewer's dist-app pattern exactly, so the CLI
// resolver code is identical. Talks to the same-origin /api/* routes the CLI
// server exposes over the in-memory BoobooIndex (no separate REST process).
export default defineConfig({
  root: "app",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@booboo-brain/spec": path.resolve(__dirname, "../spec/src/index.ts") },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-app"),
    emptyOutDir: true,
  },
});
