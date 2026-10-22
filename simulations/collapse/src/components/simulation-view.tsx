import { Section } from "@concord-consortium/mass-sims-shared";
import { Timeline } from "./timeline/timeline";
import { YearStepper } from "./year-stepper/year-stepper";
import "./simulation-view.scss";

/** The Simulation slot's layout. The remaining placeholders are filled in by later stories. */
export function SimulationView() {
  return (
    <div className="collapse-simulation">
      <Timeline />
      <div className="collapse-controls">
        <YearStepper />
        {/* Holds Sample's place (data-table story) so the stepper does not move when it arrives.
            Built like the shared Button with an icon, so it is as wide as the real one will be. */}
        <span className="button collapse-sample-slot" aria-hidden="true">
          <span className="collapse-sample-slot-icon" />
          Sample
        </span>
      </div>
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
