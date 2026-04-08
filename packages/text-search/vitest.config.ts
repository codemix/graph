import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  test: {
    exclude: ["dist/**", "coverage/**", "**/node_modules/**"],
    clearMocks: true,
    globals: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
      include: ["src/**/*.ts"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/test/**",
      ],
    },
  },
});
