import { Button, useAnnounce, useLogEvent } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { FunctionComponent, SVGProps } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";
import ResetIcon from "../assets/icons/reset.svg?react";
import RunIcon from "../assets/icons/run.svg?react";
import { OUTCOME_BANNER } from "../model/weather";
import { useStores } from "../stores/root-store";
import type { MapView } from "./map-stage";

import "./control-bar.scss";

/**
 * Street ⇄ Satellite map-view toggle. Built on react-aria's SwitchField/SwitchButton (mirroring
 * bananas' FungusSwitch) so it's a real `role="switch"` with the bordered dual-label segmented look.
 * Controlled by the panel's `mapView`; toggling calls `onToggle`. The visible Street/Satellite labels
 * are decorative (aria-hidden); the accessible name comes from the sr-only label child.
 */
function MapViewToggle({ mapView, onToggle }: { mapView: MapView; onToggle: () => void }) {
  const isSatellite = mapView === "satellite";
  return (
    <SwitchField
      className="map-view-toggle"
      isSelected={isSatellite}
      onChange={onToggle}
      onKeyDown={(e) => {
        // react-aria toggles a switch on Space (native checkbox) but not Enter; add Enter to match
        // the established convention used by bananas' FungusSwitch (RAC's SwitchButton doesn't forward
        // onKeyDown, so handle it on the container). Ignore auto-repeat so a held key doesn't oscillate
        // the state.
        if (e.key === "Enter" && !e.repeat) {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <SwitchButton className="map-view-button">
        <span className="sr-only">Map view: {isSatellite ? "Satellite" : "Street"}</span>
        <span
          className={`map-view-state${isSatellite ? "" : " map-view-state--active"}`}
          data-text="Street"
          aria-hidden="true"
        >
          Street
        </span>
        <span className="map-view-track">
          <span className="map-view-thumb" />
        </span>
        <span
          className={`map-view-state${isSatellite ? " map-view-state--active" : ""}`}
          data-text="Satellite"
          aria-hidden="true"
        >
          Satellite
        </span>
      </SwitchButton>
    </SwitchField>
  );
}

interface ControlButtonProps {
  label: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  isDisabled: boolean;
  onPress: () => void;
}

/** A Run / Replay / Reset Trial button. Disabled buttons stay focusable and block their onPress. */
function ControlButton({ label, Icon, isDisabled, onPress }: ControlButtonProps) {
  return (
    <Button isDisabled={isDisabled} onPress={onPress} className="control-button">
      <Icon className="control-button-icon" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}

interface ControlBarProps {
  mapView: MapView;
  onToggleMapView: () => void;
}

/**
 * The Simulation panel's bottom control bar: the Street ⇄ Satellite map-view toggle, Run/Replay, and
 * Reset Trial. `observer`-wrapped so the buttons track the active trial's setup/lock state. Analytics
 * events are emitted explicitly (Run carries the computed outcome; the raw switch can't auto-emit);
 * narration routes through the shared `<Announcer>`. The provisional event schema is finalized in the
 * logging story.
 */
export const ControlBar = observer(function ControlBar({
  mapView,
  onToggleMapView,
}: ControlBarProps) {
  const { activeTrial: trial, resetTrial, ui } = useStores();
  const logEvent = useLogEvent();
  const announce = useAnnounce();
  const letter = ui.selectedTrialLetter;

  const handleToggleMapView = () => {
    const view = mapView === "street" ? "satellite" : "street";
    logEvent("map_view_changed", { trial: letter, view });
    announce(
      view === "satellite" ? "Satellite view — aerial imagery" : "Street view — illustrated map",
    );
    onToggleMapView();
  };

  const handleRun = () => {
    const replay = trial.hasRun; // captured before the run so Replay reports replay: true
    trial.run();
    const outcome = trial.outcome;
    // Run is gated on `setupComplete`, so `run()` always records an outcome — the guard just narrows.
    if (!outcome) return;
    logEvent("simulation_run", { trial: letter, replay, outcome });
    announce(`Simulation complete: ${OUTCOME_BANNER[outcome]}`);
  };

  const handleReset = () => {
    logEvent("trial_reset", { trial: letter });
    resetTrial();
    announce(`Trial ${letter} reset.`);
  };

  return (
    <div className="control-bar">
      <MapViewToggle mapView={mapView} onToggle={handleToggleMapView} />
      <ControlButton
        label={trial.hasRun ? "Replay" : "Run"}
        Icon={RunIcon}
        isDisabled={!trial.setupComplete}
        onPress={handleRun}
      />
      <ControlButton
        label="Reset Trial"
        Icon={ResetIcon}
        isDisabled={!trial.canReset}
        onPress={handleReset}
      />
    </div>
  );
});
