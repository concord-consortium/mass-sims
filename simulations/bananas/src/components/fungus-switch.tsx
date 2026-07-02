import { useLogEvent } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { useLayoutEffect, useRef, useState } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";
import FungusAddedIcon from "../assets/icons/fungus-added.svg?react";

import "./fungus-switch.scss";

export interface FungusSwitchProps {
  isOn: boolean;
  isDisabled?: boolean;
  onChange: (value: boolean) => void;
  /** Trial letter targeted by this toggle, threaded in from <ControlBar> to keep this leaf pure. */
  trial: string;
}

/**
 * Bananas-local Fungus toggle, built on react-aria-components' SwitchField + SwitchButton.
 * Emits `fungus_set` with the new boolean on toggle. The "Off"/"On" text and icon are
 * decorative (aria-hidden): the accessible name is the visible "Fungus" label and the on/off
 * value comes from the switch role's checked state. A visually-hidden live region announces
 * "Fungus introduced." / "Fungus removed." on toggle.
 */
export function FungusSwitch({ isOn, isDisabled = false, onChange, trial }: FungusSwitchProps) {
  const logEvent = useLogEvent();
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Mark the underlying role="switch" input aria-disabled when locked rather than passing
  // isDisabled to SwitchField (which renders a native `disabled` input, dropping it from the tab
  // order so keyboard users can't discover it). RAC doesn't expose a prop to place aria-disabled
  // on the input, so set it directly. The toggle is blocked in handleChange below. useLayoutEffect
  // so a switch that mounts already-locked (e.g. restored saved state with crosses) exposes
  // aria-disabled before paint, never a frame without it.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (isDisabled) input.setAttribute("aria-disabled", "true");
    else input.removeAttribute("aria-disabled");
  }, [isDisabled]);
  const handleChange = (value: boolean) => {
    // Locked: ignore react-aria's onChange (fired by Space/click). Because the switch is
    // controlled (isSelected={isOn}), swallowing onChange leaves the parent's isOn unchanged, so
    // it can't toggle — no flicker.
    if (isDisabled) return;
    logEvent("fungus_set", { value, trial });
    setAnnouncement(value ? "Fungus introduced." : "Fungus removed.");
    onChange(value);
  };
  return (
    <>
      <SwitchField
        className={clsx("fungus-switch", isDisabled && "disabled")}
        isSelected={isOn}
        inputRef={inputRef}
        onChange={handleChange}
        onKeyDown={(e) => {
          // react-aria toggles on Space (native checkbox) but not Enter; add Enter to match the
          // demo. RAC's SwitchButton doesn't forward onKeyDown, so handle it here on the container
          // — the switch input is the only focusable descendant, so the event always comes from it.
          // Ignore auto-repeats so a held key doesn't oscillate the toggle (native Space doesn't repeat).
          if (e.key === "Enter" && !e.repeat && !isDisabled) {
            e.preventDefault();
            handleChange(!isOn);
          }
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
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
