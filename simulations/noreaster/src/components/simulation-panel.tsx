import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";
import { useStores } from "../stores/root-store";
import { AirMassSelectors } from "./air-mass-selectors";
import { ControlBar } from "./control-bar";
import { MapStage, type MapView } from "./map-stage";
import { useNorScaling } from "./use-nor-scaling";

import "./simulation-panel.scss";

/**
 * Nor'easter Simulation panel: a flex column of the air-mass selectors, map stage, and control bar,
 * with the active-trial letter badge anchored to the section's top-left corner.
 *
 * The Street/Satellite basemap is a view preference — local, non-persisted UI state owned here and
 * threaded to the control bar (the toggle) and the map stage (the basemap). It is deliberately NOT in
 * MST/saved state: it's not per-trial and survives trial switches (the panel doesn't unmount).
 */
export const SimulationPanel = observer(function SimulationPanel() {
  const { ui } = useStores();
  // Drives continuous responsive scaling of the controls (gap/padding/icon interpolation + the
  // condensed-font / short-header swaps) off the panel's own width.
  const panelRef = useRef<HTMLDivElement>(null);
  useNorScaling(panelRef);

  const [mapView, setMapView] = useState<MapView>("street");
  const toggleMapView = useCallback(() => {
    setMapView((view) => (view === "street" ? "satellite" : "street"));
  }, []);

  return (
    <>
      <span className="active-trial-badge" aria-hidden="true">
        {ui.selectedTrialLetter}
      </span>
      <div className="noreaster-simulation-panel" ref={panelRef}>
        <AirMassSelectors />
        <MapStage mapView={mapView} />
        <ControlBar mapView={mapView} onToggleMapView={toggleMapView} />
      </div>
    </>
  );
});
