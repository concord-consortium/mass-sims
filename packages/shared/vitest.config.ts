import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

// `globals: false` matches the project-wide convention — tests always import from
// "vitest" rather than relying on injected globals (see Addendum A.2 of the plan).
//
// svgr (svgo off) transforms the `?react` icon imports in this package's own
// source. Configured inline rather than via the `svgrPlugin` helper because a
// self-referential import of src/vite-config.ts would cross this package's
// tsconfig project boundary; the options mirror that helper.

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
