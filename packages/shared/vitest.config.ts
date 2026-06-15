import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

// `globals: false` matches the project-wide convention — tests always import from
// "vitest" rather than relying on injected globals (see Addendum A.2 of the plan).
//
// Configured inline rather than via the shared `createSimVitestConfig` helper:
// importing it (or `svgrPlugin`) from this package's own src/ would cross its
// tsconfig project boundary. svgr (svgo off) transforms the `?react` icon imports.

export default defineConfig({
  plugins: [svgr({ svgrOptions: { svgo: false } }), react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
