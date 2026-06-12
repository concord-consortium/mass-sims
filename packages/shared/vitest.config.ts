import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

// `globals: false` matches the project-wide convention — tests always import from
// "vitest" rather than relying on injected globals (see Addendum A.2 of the plan).
//
// svgr (svgo off) transforms this package's own `?react` icon imports. Inlined
// rather than importing the `svgrPlugin` helper, which would cross this
// package's tsconfig project boundary.

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
