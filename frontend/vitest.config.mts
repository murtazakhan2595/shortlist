import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

// Integration tests use the real database: settings from .env.local locally, repository secrets in CI.
const LOCAL_ENV_FILE = ".env.local";
const localEnv = existsSync(LOCAL_ENV_FILE) ? parseEnv(readFileSync(LOCAL_ENV_FILE, "utf8")) : {};

// Server code imports "server-only", which throws outside React Server Components.
// Node test projects load its empty version instead; component tests keep the real one,
// so a client component that pulls in server code fails its test.
const serverOnlyForNodeTests = {
  "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
};

// Test levels (see AGENTS.md at the repo root):
// L1 unit, L2 component, L3 integration and the repository rules run here.
// L4 database tests are pgTAP files in supabase/tests; L5 end-to-end tests are Playwright files in e2e/.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": src } },
  test: {
    projects: [
      {
        extends: true,
        resolve: { alias: serverOnlyForNodeTests },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "evals/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        resolve: { alias: serverOnlyForNodeTests },
        test: {
          name: "integration",
          environment: "node",
          env: localEnv,
          include: ["tests/integration/**/*.test.ts"],
          // These talk to the real Supabase project over the network, which can take several seconds from CI.
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "rules",
          environment: "node",
          include: ["tests/rules/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
