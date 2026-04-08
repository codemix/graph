import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  test: {
    exclude: ["dist/**", "coverage/**", "**/node_modules/**"],
    clearMocks: true,
    globals: true,
    testTimeout: 20_000,
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
        "src/grammar.js",
        "src/grammar.d.ts",
      ],
    },
  },
  resolve: {},
});
