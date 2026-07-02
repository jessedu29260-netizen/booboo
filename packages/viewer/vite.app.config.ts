import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Standalone viewer APP build (distinct from the tsup library build).
// Bundles React + three + the viewer into self-contained static assets that
// `booboo view` serves locally — so an end user sees their 3D brain without
// cloning the monorepo. Loads any snapshot at runtime via ?file=<url>.
export default defineConfig({
  root: "app",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@booboo/spec": path.resolve(__dirname, "../spec/src/index.ts") },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-app"),
    emptyOutDir: true,
  },
});
