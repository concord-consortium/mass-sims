import { ControlBar } from "./control-bar";
import { ParentSelectors } from "./parent-selectors";

import "./simulation-panel.scss";

export function SimulationPanel() {
  return (
    <div className="bananas-simulation-panel">
      <ParentSelectors />

      {/* role="status" + aria-live so future dynamic updates announce. Statically
          renders the demo's "two parents selected, no crosses" state (its State 1):
          the pill prompts to cross, the stage shows the offspring-count hint. */}
      <div className="status-pill-wrap">
        <div className="status-pill" role="status" aria-live="polite">
          Click <strong>Cross Plants</strong> to see their offspring
        </div>
      </div>

      <section className="offspring-grid" aria-label="Offspring">
        <p className="offspring-grid-placeholder">Each cross will produce 5–20 offspring.</p>
      </section>

      <ControlBar />
    </div>
  );
}
