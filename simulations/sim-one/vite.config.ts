import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite config for sim-one. See sim-two/vite.config.ts for notes on the `base: "./"` choice
// (the publicPath spike that lets a single build artifact be served from any versioned subfolder).
// Different port from sim-two so both can run in parallel locally.

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Vite equivalent of Webpack's `publicPath: "auto"` — see docs/infrastructure-plan.md §8.
  // When a URL is being emitted from JS (an asset/chunk reference inside the bundle), emit a
  // runtime expression that resolves relative to the bundle's own URL rather than the HTML's.
  // This is what makes the index-top.html promotion pattern work: HTML at /mass-sims/sim-one/
  // can load JS from /mass-sims/version/v1.2.3/sim-one/, and JS asset references still resolve
  // to /mass-sims/version/v1.2.3/sim-one/... not to /mass-sims/sim-one/....
  // For HTML/CSS emission, keep the relative behavior (HTML knows its own location).
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === "js") {
        return { runtime: `globalThis.__assetUrl(${JSON.stringify(filename)})` };
      }
      return { relative: true };
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash:8][extname]",
        chunkFileNames: "assets/[name]-[hash:8].js",
        entryFileNames: "assets/[name]-[hash:8].js",
      },
    },
  },
  server: {
    port: 8082,
    open: false,
  },
});
