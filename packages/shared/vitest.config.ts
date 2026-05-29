import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest config for @concord-consortium/mass-sims-shared.
// - React plugin for JSX/TSX in tests (renderHook uses a React tree internally).
// - jsdom for DOM APIs that React Testing Library needs.
// - globals: false → always import test functions from "vitest" (see Addendum A.2 of the plan).

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
