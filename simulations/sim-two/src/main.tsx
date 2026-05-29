import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

// Runtime asset-URL resolver — see sim-one/src/main.tsx for the full explanation.
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
