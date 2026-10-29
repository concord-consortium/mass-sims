import { Section } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { formatYears } from "../model/timeline";
import { useStores } from "../stores/root-store";
import { DataTable } from "./data-table/data-table";
import { SampleButton } from "./sample-button/sample-button";
import { Timeline } from "./timeline/timeline";
import { YearStepper } from "./year-stepper/year-stepper";
import "./simulation-view.scss";

/** The Simulation slot's layout. */
export const SimulationView = observer(function SimulationView() {
  const selected = useStores().selectedSample;
  return (
    <div className="collapse-simulation">
      <Timeline />
      <div className="collapse-controls">
        <YearStepper />
        <SampleButton />
      </div>
      <div className="collapse-stage-row">
        <DataTable />
        <Section title="Cross Section" className="collapse-cross-section">
          {/* The drawing goes under the caption in MAS-59. */}
          {selected ? (
            <p className="collapse-pic-caption">{formatYears(selected.years)} yr before collapse</p>
          ) : (
            <p className="collapse-placeholder">
              <i>Select a row in the table to see its cross section.</i>
            </p>
          )}
        </Section>
      </div>
    </div>
  );
});
