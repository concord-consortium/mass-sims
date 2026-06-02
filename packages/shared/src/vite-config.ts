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
      // Make JS-emitted asset URLs resolve relative to the chunk that's executing rather
      // than to the HTML's location. This is the Vite equivalent of Webpack's
      // `publicPath: "auto"` — needed for the promoted top-level release pattern where
      // the HTML at `/mass-sims/<sim>/index.html` loads JS from
      // `/mass-sims/version/<tag>/<sim>/assets/main-<hash>.js`, and that JS in turn needs
      // to reference sibling assets in the same versioned `assets/` folder.
      //
      // Chunks live at `<sim>/assets/<chunk>-<hash>.js`, so `new URL("..", import.meta.url)`
      // resolves to the sim's root. `filename` is the asset path relative to that root
      // (e.g. "assets/test-image-abc.png"), so appending it yields the right absolute URL
      // regardless of where the HTML is hosted. CSS-emitted URLs stay relative — they're
      // resolved by the browser relative to the CSS file, which always sits next to the
      // assets it references.
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
