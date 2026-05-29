import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest config for the starter sim.
// Kept separate from vite.config.ts so the test pipeline is independent of build-time concerns.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
