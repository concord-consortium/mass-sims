import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import svgr from "vite-plugin-svgr";

/**
 * svgr plugin: `import Icon from "./icon.svg?react"` → a React component; plain
 * `import url from "./icon.svg"` stays a URL. svgo is off so hand-authored
 * `fill="currentColor"` + `viewBox` survive (lets icons be themed via CSS
 * `color`). Every sim's Vite build and Vitest config needs it, since the
 * `?react` imports live in this package's source.
 */
export function svgrPlugin(): Plugin {
  return svgr({ svgrOptions: { svgo: false } });
}

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
  // VITE_GA_PROPERTY_ID from Vite's resolved env (merges `.env*` files + matching process.env).
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
    plugins: [svgrPlugin(), react(), gtagInjector()],
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
