import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["**/*.test.ts", "src/core/index.ts"],
      // Core holds the rules that decide what a guest can see, so it stays fully tested.
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
