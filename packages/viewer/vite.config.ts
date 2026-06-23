import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Playground dev server: renders the demo (or ?n=<count> synthetic) brain via @booboo/viewer.
export default defineConfig({
  root: "playground",
  plugins: [react()],
  resolve: {
    alias: { "@booboo/spec": path.resolve(__dirname, "../spec/src/index.ts") },
  },
  server: { fs: { allow: [path.resolve(__dirname, "../..")] } },
});
