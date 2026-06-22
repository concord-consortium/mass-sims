import { Button } from "@concord-consortium/mass-sims-shared";
import type { FunctionComponent, SVGProps } from "react";

import CrossIcon from "../assets/icons/cross.svg?react";
import ResetIcon from "../assets/icons/reset.svg?react";
import { FungusSwitch } from "./fungus-switch";

import "./control-bar.scss";

interface ControlButtonProps {
  label: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  isDisabled: boolean;
  onPress: () => void;
  /** Log-event name emitted on press by the shared <Button>. */
  action: string;
}

function ControlButton({ label, Icon, isDisabled, onPress, action }: ControlButtonProps) {
  return (
    <Button isDisabled={isDisabled} onPress={onPress} action={action} className="control-button">
      <Icon className="control-button-icon" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}

export interface ControlBarProps {
  canCross: boolean;
  fungusOn: boolean;
  isFungusLocked: boolean;
  canReset: boolean;
  onCrossPlants: () => void;
  onSetFungus: (value: boolean) => void;
  onResetTrial: () => void;
}

export function ControlBar({
  canCross,
  fungusOn,
  isFungusLocked,
  canReset,
  onCrossPlants,
  onSetFungus,
  onResetTrial,
}: ControlBarProps) {
  return (
    <div className="control-bar">
      <FungusSwitch isOn={fungusOn} isDisabled={isFungusLocked} onChange={onSetFungus} />
      <ControlButton
        label="Cross Plants"
        Icon={CrossIcon}
        isDisabled={!canCross}
        onPress={onCrossPlants}
        action="cross_plants_pressed"
      />
      <ControlButton
        label="Reset Trial"
        Icon={ResetIcon}
        isDisabled={!canReset}
        onPress={onResetTrial}
        action="reset_trial_pressed"
      />
    </div>
  );
}
