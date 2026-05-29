import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite config for sim-two.
//
// PUBLICPATH SPIKE: `base: "./"` makes the built bundle reference its assets relative to
// the HTML file's directory. That's what lets a single build artifact be deployed to any
// versioned subfolder on S3 (e.g. `/mass-sims/branch/main/sim-two/`,
// `/mass-sims/version/v1.2.3/sim-two/`) without rebuilding.
//
// This sim exists primarily to verify that the multi-sim monorepo deploy pattern works.

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Vite equivalent of Webpack's `publicPath: "auto"` — see sim-one/vite.config.ts and
  // docs/infrastructure-plan.md §8 for the full explanation of the index-top.html pattern.
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
    port: 8081,
    open: false,
  },
});
