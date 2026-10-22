import { existsSync, readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Imports flow one way: shared code (components, lib, server) -> features -> app.
// Features never import from each other. See "Architecture" in AGENTS.md.
const FEATURES_DIR = "./src/features";
const features = existsSync(FEATURES_DIR)
  ? readdirSync(FEATURES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const importDirectionZones = [
  ...["components", "lib", "server"].map((shared) => ({
    target: `./src/${shared}`,
    from: ["./src/features", "./src/app"],
    message: "Shared code cannot import from features or app.",
  })),
  {
    target: FEATURES_DIR,
    from: "./src/app",
    message: "Features cannot import from app.",
  },
  ...features.map((feature) => ({
    target: `${FEATURES_DIR}/${feature}`,
    from: FEATURES_DIR,
    except: [`./${feature}`],
    message: "Features cannot import from other features. Hand off work through the queue instead.",
  })),
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "import/no-restricted-paths": ["error", { zones: importDirectionZones }],
    },
  },
  // The app logs only warnings and errors on purpose; a console.log is debugging left behind.
  // Scripts print their results, so they may use it.
  {
    files: ["src/**"],
    rules: {
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
