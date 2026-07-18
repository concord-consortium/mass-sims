import { Button } from "@concord-consortium/mass-sims-shared";
import type { FunctionComponent, SVGProps } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";
import ResetIcon from "../assets/icons/reset.svg?react";
import RunIcon from "../assets/icons/run.svg?react";

import "./control-bar.scss";

// The map-view toggle is locked to Street: controlled to the off/Street position with a swallowed
// onChange, so activating it never changes state.
const swallowChange = () => {};

/**
 * Street ⇄ Satellite map-view toggle — locked to Street and inert. Built on react-aria's
 * SwitchField/SwitchButton (mirroring bananas' FungusSwitch) so it's a real `role="switch"` with the
 * bordered dual-label segmented look, but controlled to `false` with a no-op onChange so it can't
 * leave Street. The visible Street/Satellite labels are decorative (aria-hidden); the accessible name
 * comes from the sr-only label child.
 */
function MapViewToggle() {
  return (
    <SwitchField className="map-view-toggle" isSelected={false} onChange={swallowChange}>
      <SwitchButton className="map-view-button">
        <span className="sr-only">Map view: Street</span>
        <span
          className="map-view-state map-view-state--active"
          data-text="Street"
          aria-hidden="true"
        >
          Street
        </span>
        <span className="map-view-track">
          <span className="map-view-thumb" />
        </span>
        <span className="map-view-state" data-text="Satellite" aria-hidden="true">
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
}

/** A Run / Reset Trial button. Both render disabled (no behavior wired yet). */
function ControlButton({ label, Icon, isDisabled }: ControlButtonProps) {
  return (
    <Button isDisabled={isDisabled} className="control-button">
      <Icon className="control-button-icon" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}

/**
 * The Simulation panel's bottom control bar: map-view toggle (locked to Street), Run, Reset Trial.
 * Run and Reset render disabled (no behavior wired yet).
 */
export function ControlBar() {
  return (
    <div className="control-bar">
      <MapViewToggle />
      <ControlButton label="Run" Icon={RunIcon} isDisabled />
      <ControlButton label="Reset Trial" Icon={ResetIcon} isDisabled />
    </div>
  );
}
