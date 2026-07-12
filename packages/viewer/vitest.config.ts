import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: that one sets root: "playground" for the
// dev server, which would make vitest look for tests under playground/ instead of test/.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
