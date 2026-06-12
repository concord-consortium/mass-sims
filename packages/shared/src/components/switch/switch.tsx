import clsx from "clsx";
import type { ReactNode } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";

import "./switch.scss";

export interface SwitchProps {
  children?: ReactNode;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  action?: string;
  actionParams?: Record<string, unknown>;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Token-driven boolean toggle on `react-aria-components`'s `SwitchField` + `SwitchButton`
 * (the flat `Switch` is deprecated in rac ^1.18). Auto-emits via `useLogEvent` on toggle
 * when `action` is supplied.
 */
export function Switch({
  children,
  isSelected,
  defaultSelected,
  onChange,
  action,
  actionParams,
  isDisabled,
  className,
}: SwitchProps) {
  const logEvent = useLogEvent();
  return (
    <SwitchField
      isSelected={isSelected}
      defaultSelected={defaultSelected}
      isDisabled={isDisabled}
      onChange={(v) => {
        if (action) logEvent(action, { value: v, ...actionParams });
        onChange?.(v);
      }}
      className={clsx("switch", className)}
    >
      <SwitchButton className="switch-button">
        <div className="indicator" aria-hidden="true" />
        {children}
      </SwitchButton>
    </SwitchField>
  );
}
