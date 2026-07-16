import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WidthPreview } from "./width-preview";

// Entry point for the dev-only width preview. Served to the host sim's Vite dev server by
// `widthPreviewPlugin()` (see preview-plugin.ts), which mounts it at /__preview and supplies the sim
// name + URL via data attributes on the root element.

const rootEl = document.getElementById("preview-root");
if (!rootEl) throw new Error("Could not find #preview-root element");

const simName = rootEl.dataset.simName ?? "sim";
// Absolute, and never derived from this page's own URL — that would break under a trailing slash.
const simUrl = rootEl.dataset.simUrl ?? "/index.html";

createRoot(rootEl).render(
  <StrictMode>
    <WidthPreview simName={simName} simUrl={simUrl} />
  </StrictMode>,
);
