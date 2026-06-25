import { Button } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { FunctionComponent, SVGProps } from "react";

import CrossIcon from "../assets/icons/cross.svg?react";
import ResetIcon from "../assets/icons/reset.svg?react";
import { useStores } from "../stores/root-store";
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

export const ControlBar = observer(function ControlBar() {
  const rootStore = useStores();
  const trial = rootStore.activeTrial;
  return (
    <div className="control-bar">
      <FungusSwitch
        isOn={trial.fungusOn}
        isDisabled={trial.isFungusLocked}
        onChange={(value) => trial.setFungus(value)}
      />
      <ControlButton
        label="Cross Plants"
        Icon={CrossIcon}
        isDisabled={!trial.canCross}
        onPress={() => trial.crossPlants()}
        action="cross_plants_pressed"
      />
      <ControlButton
        label="Reset Trial"
        Icon={ResetIcon}
        isDisabled={!trial.canReset}
        onPress={() => rootStore.resetTrial()}
        action="reset_trial_pressed"
      />
    </div>
  );
});
