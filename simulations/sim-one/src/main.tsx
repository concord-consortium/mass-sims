import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

// Runtime asset-URL resolver — used by Vite's `experimental.renderBuiltUrl` callback in
// vite.config.ts. Computes the asset base from this bundle's own URL so JS-emitted asset
// references resolve correctly whether loaded from /mass-sims/version/v1.2.3/sim-one/main.js
// or referenced from a promoted top-level HTML at /mass-sims/sim-one/index.html.
//
// IMPORTANT: ES module imports are hoisted, so this code runs AFTER the imports above
// execute. That's fine for this placeholder sim (no asset imports). When a future sim
// adds `import x from "./some-asset.png"`, the setup needs to move to a separate file
// imported as the first import. See docs/infrastructure-plan.md §8 for the pattern.
const assetBase = new URL("..", import.meta.url).href;
Object.assign(globalThis, {
  __assetUrl: (filename: string) => assetBase + filename,
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Could not find #root element in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
