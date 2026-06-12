import clsx from "clsx";
import type { ReactNode } from "react";
import { CheckboxButton, CheckboxField } from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";

import "./checkbox.scss";

export interface CheckboxProps {
  children?: ReactNode;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isIndeterminate?: boolean;
  onChange?: (isSelected: boolean) => void;
  action?: string;
  actionParams?: Record<string, unknown>;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Token-driven boolean toggle on `react-aria-components`'s `CheckboxField` + `CheckboxButton`
 * (the flat `Checkbox` is deprecated in rac ^1.18). Auto-emits via `useLogEvent` on toggle
 * when `action` is supplied. Supports the indeterminate state.
 */
export function Checkbox({
  children,
  isSelected,
  defaultSelected,
  isIndeterminate,
  onChange,
  action,
  actionParams,
  isDisabled,
  className,
}: CheckboxProps) {
  const logEvent = useLogEvent();
  return (
    <CheckboxField
      isSelected={isSelected}
      defaultSelected={defaultSelected}
      isIndeterminate={isIndeterminate}
      isDisabled={isDisabled}
      onChange={(v) => {
        if (action) logEvent(action, { value: v, ...actionParams });
        onChange?.(v);
      }}
      className={clsx("checkbox", className)}
    >
      <CheckboxButton className="checkbox-button">
        <div className="indicator" aria-hidden="true" />
        {children}
      </CheckboxButton>
    </CheckboxField>
  );
}
