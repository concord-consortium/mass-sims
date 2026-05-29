import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite config for sim-one. See sim-two/vite.config.ts for notes on the `base: "./"` choice
// (the publicPath spike that lets a single build artifact be served from any versioned subfolder).
// Different port from sim-two so both can run in parallel locally.

export default defineConfig({
  base: "./",
  plugins: [react()],
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
