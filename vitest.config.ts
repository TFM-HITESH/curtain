import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/platform/**/*.ts"],
      exclude: ["**/*.test.ts", "src/*/index.ts"],
      // Core decides what a guest can see and platform guards every browser call, so both stay fully tested.
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
