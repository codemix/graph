import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/graph",
      "packages/text-search",
      "packages/y-graph-storage",
    ],
    coverage: {},
  },
});
