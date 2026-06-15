import { svgrPlugin } from "@concord-consortium/mass-sims-shared/vite-config";
import react from "@vitejs/plugin-react";
import { defineConfig, type ViteUserConfig } from "vitest/config";

/**
 * Shared Vitest config for sims. jsdom + the project conventions (globals off,
 * `src` test glob, no CSS) plus the svgr plugin for `?react` icon imports and a
 * per-package `src/test-setup.ts`.
 */
export function createSimVitestConfig(): ViteUserConfig {
  return defineConfig({
    plugins: [svgrPlugin(), react()],
    test: {
      environment: "jsdom",
      globals: false,
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      setupFiles: ["./src/test-setup.ts"],
    },
  });
}
