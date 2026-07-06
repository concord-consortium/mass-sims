import { Button, useAnnounce, useLogEvent } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { FunctionComponent, SVGProps } from "react";

import CrossIcon from "../assets/icons/cross.svg?react";
import ResetIcon from "../assets/icons/reset.svg?react";
import { MAX_CROSSES } from "../model/genetics";
import { useStores } from "../stores/root-store";
import { FungusSwitch } from "./fungus-switch";

import "./control-bar.scss";

interface ControlButtonProps {
  label: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  isDisabled: boolean;
  onPress: () => void;
}

function ControlButton({ label, Icon, isDisabled, onPress }: ControlButtonProps) {
  return (
    <Button isDisabled={isDisabled} onPress={onPress} className="control-button">
      <Icon className="control-button-icon" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}

export const ControlBar = observer(function ControlBar() {
  const { activeTrial, resetTrial, ui } = useStores();
  const logEvent = useLogEvent();
  const announce = useAnnounce();

  const handleCross = () => {
    const beforeLen = activeTrial.crosses.length;
    activeTrial.crossPlants();
    // Defensive: the button is gated on canCross, so a no-op cross is unreachable today.
    // The guard prevents a phantom plants_crossed event if that invariant ever changes.
    if (activeTrial.crosses.length === beforeLen) return;
    const generation = activeTrial.crosses.length;
    // Counts read from the cross just appended. Assumes crossPlants() appends exactly one cross;
    // the `?? 0` fallbacks can't fire after the length-change guard, but TS narrowing can't see that.
    const lastCross = activeTrial.crosses.at(-1);
    const offspring = lastCross?.length ?? 0;
    const healthy = lastCross?.filter((p) => !p.infected).length ?? 0;
    const infected = offspring - healthy;
    const trial = ui.selectedTrialLetter;
    logEvent("plants_crossed", { trial, generation, offspring, healthy, infected });
    // Narrate the created cross. Same-event lines are composed into ONE utterance: the first cross
    // locks the parents + fungus, and the last cross hits the crosses cap — both are appended here
    // rather than issued as separate announce() calls, so a screen reader hears one coherent line.
    let message = `Cross ${trial}${generation}: ${offspring} offspring, ${healthy} healthy, ${infected} infected.`;
    if (beforeLen === 0) message += " Parents locked.";
    if (generation === MAX_CROSSES) message += ` Maximum of ${MAX_CROSSES} crosses reached.`;
    announce(message);
  };

  const handleReset = () => {
    const trial = ui.selectedTrialLetter;
    logEvent("trial_reset", { trial });
    resetTrial();
    announce(`Trial ${trial} reset.`);
  };

  return (
    <div className="control-bar">
      <FungusSwitch
        isOn={activeTrial.fungusOn}
        isDisabled={activeTrial.isFungusLocked}
        onChange={(value) => activeTrial.setFungus(value)}
        trial={ui.selectedTrialLetter}
      />
      <ControlButton
        label="Cross Plants"
        Icon={CrossIcon}
        isDisabled={!activeTrial.canCross}
        onPress={handleCross}
      />
      <ControlButton
        label="Reset Trial"
        Icon={ResetIcon}
        isDisabled={!activeTrial.canReset}
        onPress={handleReset}
      />
    </div>
  );
});
