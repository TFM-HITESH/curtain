import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const modules = ["core", "platform", "engine", "ui", "sites", "entrypoints"];

const moduleImportPatterns = [
  {
    regex: `^@/(${modules.join("|")})/.+`,
    message:
      "Import from the module's public entry point (for example `@/core`), not its internals.",
  },
  {
    regex: `^(\\.\\./)+(${modules.join("|")})(/|$)`,
    message:
      "Import other modules through their alias (for example `@/core`), not relative paths.",
  },
];

const browserApiMessage =
  "Use the wrappers in `@/platform` instead of calling browser APIs directly.";
const browserApiImport = { name: "wxt/browser", message: browserApiMessage };
const browserApiGlobals = [
  { name: "chrome", message: browserApiMessage },
  { name: "browser", message: browserApiMessage },
];

export default defineConfig(
  globalIgnores([".output/", ".wxt/", "coverage/"]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // Architecture: modules only depend inward, and sites never depend on each other.
  {
    files: ["src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": [
        { type: "core", pattern: "src/core" },
        { type: "platform", pattern: "src/platform" },
        { type: "engine", pattern: "src/engine" },
        { type: "ui", pattern: "src/ui" },
        // Order matters: each site folder first, then the registry beside them.
        { type: "site", pattern: "src/sites/*" },
        { type: "site-registry", pattern: "src/sites" },
        { type: "entrypoint", pattern: "src/entrypoints" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "platform" } },
              allow: { to: { element: { types: ["core"] } } },
            },
            {
              from: { element: { type: "engine" } },
              allow: { to: { element: { types: ["core", "platform"] } } },
            },
            {
              from: { element: { type: "ui" } },
              allow: {
                to: { element: { types: ["core", "platform", "engine"] } },
              },
            },
            {
              from: { element: { type: "site" } },
              allow: { to: { element: { types: ["core", "engine"] } } },
            },
            {
              from: { element: { type: "site-registry" } },
              allow: { to: { element: { types: ["site", "engine"] } } },
            },
            {
              from: { element: { type: "entrypoint" } },
              allow: {
                to: {
                  element: {
                    types: [
                      "core",
                      "platform",
                      "engine",
                      "ui",
                      "site-registry",
                    ],
                  },
                },
              },
            },
          ],
        },
      ],
      // Cross-module imports go through each module's public entry point, `@/<module>`.
      "no-restricted-imports": [
        "error",
        { paths: [browserApiImport], patterns: moduleImportPatterns },
      ],
      // Browser APIs are wrapped in `src/platform`, so the rest stays testable and portable.
      "no-restricted-globals": ["error", ...browserApiGlobals],
    },
  },
  {
    files: ["src/platform/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: moduleImportPatterns }],
      "no-restricted-globals": "off",
    },
  },

  prettier,
);
