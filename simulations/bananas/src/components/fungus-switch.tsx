import { useLogEvent } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { useState } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";
import FungusAddedIcon from "../assets/icons/fungus-added.svg?react";

import "./fungus-switch.scss";

export interface FungusSwitchProps {
  isOn: boolean;
  isDisabled?: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Bananas-local Fungus toggle, built on react-aria-components' SwitchField + SwitchButton.
 * Emits `fungus_set` with the new boolean on toggle. The "Off"/"On" text and icon are
 * decorative (aria-hidden): the accessible name is the visible "Fungus" label and the on/off
 * value comes from the switch role's checked state. A visually-hidden live region announces
 * "Fungus introduced." / "Fungus removed." on toggle.
 */
export function FungusSwitch({ isOn, isDisabled = false, onChange }: FungusSwitchProps) {
  const logEvent = useLogEvent();
  const [announcement, setAnnouncement] = useState("");
  return (
    <>
      <SwitchField
        className={clsx("fungus-switch", isDisabled && "disabled")}
        isSelected={isOn}
        isDisabled={isDisabled}
        onChange={(value) => {
          logEvent("fungus_set", { value });
          setAnnouncement(value ? "Fungus introduced." : "Fungus removed.");
          onChange(value);
        }}
      >
        <SwitchButton className="fungus-switch-button">
          <FungusAddedIcon className="fungus-switch-icon" aria-hidden="true" />
          <span className="fungus-switch-label">Fungus</span>
          <span className="fungus-switch-hit">
            <span className={clsx("fungus-switch-state", !isOn && "active")} aria-hidden="true">
              Off
            </span>
            <span className={clsx("fungus-switch-track", isOn && "on")}>
              <span className="fungus-switch-thumb" />
            </span>
            <span className={clsx("fungus-switch-state", isOn && "active")} aria-hidden="true">
              On
            </span>
          </span>
        </SwitchButton>
      </SwitchField>
      {/* aria-live without role="status" so toggles are announced without colliding with the
          status pill's own role="status". */}
      <div className="fungus-switch-announcement" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
