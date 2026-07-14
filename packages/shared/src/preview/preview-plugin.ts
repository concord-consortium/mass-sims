import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const PREVIEW_ROUTE = "/__preview";

// Absolute path to the preview entry, resolved from THIS module's location so it's correct no matter
// which sim's dev server is hosting it. Loading a Vite config is a Node import, so `import.meta.url`
// is a file: URL in every real run; under Vitest the module is transformed and served over http
// instead, so fall back to the pathname there rather than throwing at import time. The backslashes
// `fileURLToPath` returns on Windows would make an invalid `/@fs/` URL — Vite's form is `/@fs/C:/…`.
const entryUrl = new URL("./main.tsx", import.meta.url);
const previewEntry =
  entryUrl.protocol === "file:" ? fileURLToPath(entryUrl).replaceAll("\\", "/") : entryUrl.pathname;

/** Minimal escaping for the two values we interpolate into the shell (both from local config). */
function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/**
 * The preview page's HTML shell. `simUrl` is handed to the page rather than left for it to derive:
 * a relative `./index.html` would resolve against the page's own URL, so a trailing slash
 * (`/__preview/`) would silently point the iframes at `/__preview/index.html`.
 */
function shell(simName: string, simUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(simName)} — width preview</title>
  </head>
  <body>
    <div id="preview-root" data-sim-name="${escapeHtml(simName)}" data-sim-url="${escapeHtml(simUrl)}"></div>
    <script type="module" src="/@fs/${previewEntry}"></script>
  </body>
</html>
`;
}

/**
 * Dev-only "width preview": serves a page at `/__preview` that renders the host sim in an `<iframe>`
 * at each of the four target widths (`../layout/target-widths.ts`), so a developer can see whether
 * the layout fits every Activity Player allocation.
 *
 * Included in `createSimViteConfig()`, so every sim gets the route with no per-sim configuration.
 * `apply: "serve"` means the plugin doesn't exist during `vite build` — the route is structurally
 * incapable of reaching `dist/`.
 *
 * The page itself lives in this package (`./main.tsx`) and reaches the sim's dev server over Vite's
 * `/@fs/` prefix, which serves any file inside `server.fs.allow` (the workspace root, in a Yarn
 * workspaces repo). So there's no HTML file to copy into each sim and no second server to run, and
 * HMR works inside every iframe exactly as in a normal `yarn dev` session.
 */
export function widthPreviewPlugin(): Plugin {
  let simName = "sim";
  let simUrl = "/index.html";

  return {
    name: "mass-sims:width-preview",
    apply: "serve",

    configResolved(config) {
      // The sim's directory name (e.g. "bananas") — used only as a caption, so the page needs no
      // per-sim config.
      simName = basename(config.root);
      // Sims set `base: "./"` for relocatable production builds; the dev server normalizes that to
      // an absolute path. Guard anyway so the iframe URL is always absolute and always rooted.
      const base = config.base?.startsWith("/") ? config.base : "/";
      simUrl = `${base.endsWith("/") ? base : `${base}/`}index.html`;
    },

    configureServer(server) {
      server.middlewares.use(PREVIEW_ROUTE, async (req, res, next) => {
        // Connect strips the mounted prefix, so a request for exactly `/__preview` (or with a
        // trailing slash / query) arrives here as "/" or "". Anything deeper isn't ours — hand it
        // back so the sim's own assets still resolve.
        const rest = (req.url ?? "/").split("?")[0];
        if (rest !== "/" && rest !== "") return next();
        try {
          // transformIndexHtml injects the Vite client + React-refresh preamble, so the preview page
          // is itself hot-reloadable.
          const html = await server.transformIndexHtml(PREVIEW_ROUTE, shell(simName, simUrl));
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        } catch (err) {
          next(err as Error);
        }
      });

      // Advertise the route in the dev-server banner, so it's discoverable without reading docs.
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        const local = server.resolvedUrls?.local[0];
        if (!local) return;
        const url = new URL(PREVIEW_ROUTE, local).href;
        server.config.logger.info(
          `  \x1b[32m➜\x1b[0m  \x1b[1mWidth preview\x1b[0m: \x1b[36m${url}\x1b[0m`,
        );
      };
    },
  };
}
