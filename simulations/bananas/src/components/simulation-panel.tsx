import { ControlBar } from "./control-bar";
import { ParentSelectors } from "./parent-selectors";

import "./simulation-panel.scss";

export function SimulationPanel() {
  return (
    <div className="bananas-simulation-panel">
      <ParentSelectors />

      {/* role="status" + aria-live so future dynamic count updates announce. */}
      <div className="status-pill-wrap">
        <div className="status-pill" role="status" aria-live="polite">
          Crosses: <b>0</b> · Offspring: <b>0</b>
        </div>
      </div>

      <section className="offspring-grid" aria-label="Offspring">
        <p className="offspring-grid-placeholder">
          Click <strong>Cross Plants</strong> to see their offspring
        </p>
      </section>

      <ControlBar />
    </div>
  );
}
