import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type UserConfig } from "vite";

/**
 * Vite plugin: when VITE_GA_PROPERTY_ID is set at build/dev time, inject the
 * gtag.js loader + bootstrap snippet into each sim's index.html in place of the
 * `<!--GA-->` placeholder. When the env var is empty/unset, the placeholder is
 * removed and no GA code ships.
 *
 * Pairs with `useLogEvent`, which fires `window.gtag('event', …)` only when the
 * snippet has loaded and `gtag` is defined. The snippet is tiny (~600 bytes
 * gzipped) and async-loaded, so disabling GA leaves zero overhead in the bundle.
 */
export function gtagInjector(): Plugin {
  // Read VITE_GA_PROPERTY_ID from Vite's resolved env (which merges `.env*` files and
  // matching `process.env` vars) rather than `process` directly — the shared package's
  // tsconfig has no Node types and we keep it that way (no new dev deps).
  let id = "";
  return {
    name: "mass-sims:gtag-injector",
    configResolved(config) {
      id = String(config.env.VITE_GA_PROPERTY_ID ?? "").trim();
    },
    transformIndexHtml(html) {
      if (!id) return html.replace(/<!--GA-->/g, "");
      const snippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${id}', { send_page_view: false });
</script>`;
      return html.replace(/<!--GA-->/g, snippet);
    },
  };
}

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
    plugins: [react(), gtagInjector()],
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
