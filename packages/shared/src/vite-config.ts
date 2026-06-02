import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

export interface SimViteConfigOverrides {
  /** Dev server port. Each sim picks a unique port so they can run in parallel. */
  port: number;
}

/**
 * Shared Vite config used by every Mass Sims simulation. Each sim's `vite.config.ts` imports
 * this and passes its sim-specific overrides (currently just the dev port).
 */
export function createSimViteConfig(overrides: SimViteConfigOverrides): UserConfig {
  return defineConfig({
    base: "./",
    plugins: [react()],
    experimental: {
      // Vite equivalent of Webpack's `publicPath: "auto"`. Chunks live at
      // `<sim>/assets/<chunk>-<hash>.js`, so `new URL("..", import.meta.url)` resolves to
      // the sim root; appending the asset path yields the right absolute URL whether the
      // HTML is at the per-version URL or the promoted top-level URL. See
      // docs/infrastructure-plan.md §8.
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === "js") {
          return {
            runtime: `new URL("../" + ${JSON.stringify(filename)}, import.meta.url).href`,
          };
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
      port: overrides.port,
      open: false,
    },
  });
}
