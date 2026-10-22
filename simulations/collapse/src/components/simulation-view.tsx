import { Section } from "@concord-consortium/mass-sims-shared";
import { Timeline } from "./timeline/timeline";
import "./simulation-view.scss";

/** The Simulation slot's layout. The remaining placeholders are filled in by later stories. */
export function SimulationView() {
  return (
    <div className="collapse-simulation">
      <Timeline />
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
