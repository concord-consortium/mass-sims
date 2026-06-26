import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@concord-consortium/mass-sims-shared/styles/global.scss";
import { App } from "./app";

// Warm Lato italic at startup. The sim's only italic text is the conditional placeholder hints
// (offspring grid + trials), so the variant isn't fetched until the first hint renders — without
// this, that first render briefly shows fallback-font (wider) text before Lato italic swaps in.
// Gated on document.fonts, which jsdom lacks.
document.fonts?.ready?.then(() => document.fonts.load("italic 16px 'Lato'"));

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Could not find #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
