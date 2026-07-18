import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { useStores } from "../stores/root-store";
import { AirMassSelectors } from "./air-mass-selectors";
import { ControlBar } from "./control-bar";
import { MapStage } from "./map-stage";
import { useNorScaling } from "./use-nor-scaling";

import "./simulation-panel.scss";

/**
 * Nor'easter Simulation panel: a flex column of the air-mass selectors, map stage, and control bar,
 * with the active-trial letter badge anchored to the section's top-left corner.
 */
export const SimulationPanel = observer(function SimulationPanel() {
  const { ui } = useStores();
  // Drives continuous responsive scaling of the controls (gap/padding/icon interpolation + the
  // condensed-font / short-header swaps) off the panel's own width.
  const panelRef = useRef<HTMLDivElement>(null);
  useNorScaling(panelRef);

  return (
    <>
      <span className="active-trial-badge" aria-hidden="true">
        {ui.selectedTrialLetter}
      </span>
      <div className="noreaster-simulation-panel" ref={panelRef}>
        <AirMassSelectors />
        <MapStage />
        <ControlBar />
      </div>
    </>
  );
});
