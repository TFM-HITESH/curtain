import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: [
        "src/core/**/*.ts",
        "src/platform/**/*.ts",
        "src/entrypoints/background/**/*.ts",
      ],
      // Entry files only wire things together.
      exclude: [
        "**/*.test.ts",
        "src/*/index.ts",
        "src/entrypoints/**/index.ts",
      ],
      // These decide what a guest can see and guard every state change, so they stay fully tested.
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
