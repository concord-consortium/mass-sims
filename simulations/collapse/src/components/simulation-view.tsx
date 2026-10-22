import { Section } from "@concord-consortium/mass-sims-shared";
import "./simulation-view.scss";

/** The Simulation slot's layout. Each container is a placeholder that a later story fills in. */
export function SimulationView() {
  return (
    <div className="collapse-simulation">
      {/* Timeline story */}
      <div className="collapse-timeline" aria-hidden="true" />
      {/* Controls story: "Years before collapse" stepper + Sample */}
      <div className="collapse-controls" />
      <div className="collapse-stage-row">
        {/* Data table story */}
        <div className="collapse-table-box">
          <p className="collapse-placeholder">
            Pick a year, then click <b>Sample</b>
          </p>
        </div>
        <Section title="Cross Section" className="collapse-cross-section">
          <p className="collapse-placeholder">
            <i>Select a row in the table to see its cross section.</i>
          </p>
        </Section>
      </div>
    </div>
  );
}
