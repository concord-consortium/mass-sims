import { Button } from "@concord-consortium/mass-sims-shared";
import type { FunctionComponent, SVGProps } from "react";

import AddFungusIcon from "../assets/icons/add-fungus.svg?react";
import CrossIcon from "../assets/icons/cross.svg?react";
import ResetIcon from "../assets/icons/reset.svg?react";

import "./control-bar.scss";

interface ControlButtonProps {
  label: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
}

function ControlButton({ label, Icon }: ControlButtonProps) {
  return (
    <Button isDisabled className="control-button">
      <Icon className="control-button-icon" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}

export function ControlBar() {
  return (
    <div className="control-bar">
      <ControlButton label="Cross Plants" Icon={CrossIcon} />
      <ControlButton label="Introduce Fungus" Icon={AddFungusIcon} />
      <ControlButton label="Reset Trial" Icon={ResetIcon} />
    </div>
  );
}
