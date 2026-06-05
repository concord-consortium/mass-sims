import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@concord-consortium/mass-sims-shared/styles/global.scss";
import { Preview } from "./preview";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Could not find #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
