import { defineConfig } from "vitest/config";

// Root Vitest config for the scripts/ tooling tests (new-sim, gen-workflows). Run via
// `yarn test:scripts`, separate from per-workspace `lerna run test`. Node env (filesystem).
export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
