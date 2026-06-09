import { defineConfig } from "vitest/config";

// Root-level Vitest config — runs ONLY the `scripts/` tests (the repo's `.ts` tooling:
// new-sim, gen-workflows, …). Per-workspace tests are run separately by `lerna run test`;
// this config is invoked via `yarn test:scripts` and is kept scoped so the two never
// overlap. Node environment (these scripts touch the filesystem, not the DOM).
export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
