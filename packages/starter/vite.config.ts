import { gtagInjector, svgrPlugin } from "@concord-consortium/mass-sims-shared/vite-config";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite config for the starter sim.
//
// PUBLICPATH SPIKE: `base: "./"` makes the built bundle reference its assets relative to
// the HTML file's directory. That's what lets a single build artifact be deployed to any
// versioned subfolder on S3 (e.g. `/mass-sims/branch/main/starter/`,
// `/mass-sims/version/v1.2.3/starter/`) without rebuilding.
//
// This is the Vite equivalent of FOSS's Webpack `publicPath: "auto"` pattern. The first
// successful CI deploy validates that asset URLs resolve correctly under a versioned path.

export default defineConfig({
  base: "./",
  plugins: [svgrPlugin(), react(), gtagInjector()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    // Asset filename pattern with short hash — readable in network panels while still
    // cache-busting. Matches the DESE pattern called out in the infrastructure plan §5.
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash:8][extname]",
        chunkFileNames: "assets/[name]-[hash:8].js",
        entryFileNames: "assets/[name]-[hash:8].js",
      },
    },
  },
  server: {
    port: 8080,
    open: false,
  },
});
