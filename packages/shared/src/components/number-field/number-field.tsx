import clsx from "clsx";
import type { ReactNode } from "react";
import { NumberField as AriaNumberField, Button, Group, Input, Label } from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";

import "./number-field.scss";

export interface NumberFieldProps {
  label?: ReactNode;
  value?: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  onChange?: (value: number) => void;
  action?: string;
  actionParams?: Record<string, unknown>;
  formatOptions?: Intl.NumberFormatOptions;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Token-driven numeric input on `react-aria-components`'s `NumberField`. Auto-emits
 * via `useLogEvent` on commit (onChange, which react-aria already debounces to the
 * natural commit event — blur / Enter / stepper press).
 *
 */
export function NumberField({
  label,
  value,
  defaultValue,
  minValue,
  maxValue,
  step,
  onChange,
  action,
  actionParams,
  formatOptions,
  isDisabled,
  className,
}: NumberFieldProps) {
  const logEvent = useLogEvent();
  return (
    <AriaNumberField
      value={value}
      defaultValue={defaultValue}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      isDisabled={isDisabled}
      formatOptions={formatOptions}
      onChange={(v) => {
        if (action) logEvent(action, { value: v, ...actionParams });
        onChange?.(v);
      }}
      className={clsx("number-field", className)}
    >
      {label != null ? <Label>{label}</Label> : null}
      <Group>
        <Button slot="decrement" aria-label="Decrease">
          −
        </Button>
        <Input />
        <Button slot="increment" aria-label="Increase">
          +
        </Button>
      </Group>
    </AriaNumberField>
  );
}
