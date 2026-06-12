import clsx from "clsx";
import type { ReactNode } from "react";
import {
  Slider as AriaSlider,
  Label,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";

import "./slider.scss";

export interface SliderProps {
  label?: ReactNode;
  value?: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  /**
   * Optional log-event name fired on commit. When omitted, no log event is sent.
   * Use snake_case per GA4's constraints — `useLogEvent` validates the format in dev.
   * The committed value is automatically included as `value` in the event params.
   */
  action?: string;
  actionParams?: Record<string, unknown>;
  formatOptions?: Intl.NumberFormatOptions;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Token-driven slider built on `react-aria-components`'s `Slider`. Auto-emits via
 * `useLogEvent` ON COMMIT (onChangeEnd) when `action` is supplied — continuous
 * mid-drag emission is intentionally avoided (infra plan §11 #28). Single-thumb
 * only; multi-thumb is deferred until a sim needs it.
 *
 * See infrastructure-plan.md §3 "Shared controls policy" for the wrapping convention.
 */
export function Slider({
  label,
  value,
  defaultValue,
  minValue = 0,
  maxValue = 100,
  step = 1,
  onChange,
  onChangeEnd,
  action,
  actionParams,
  formatOptions,
  isDisabled,
  className,
}: SliderProps) {
  const logEvent = useLogEvent();
  return (
    <AriaSlider
      value={value}
      defaultValue={defaultValue}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      isDisabled={isDisabled}
      formatOptions={formatOptions}
      onChange={(v) => onChange?.(v as number)}
      onChangeEnd={(v) => {
        const committed = v as number;
        if (action) logEvent(action, { value: committed, ...actionParams });
        onChangeEnd?.(committed);
      }}
      className={clsx("slider", className)}
    >
      {label != null ? <Label>{label}</Label> : null}
      <SliderOutput />
      <SliderTrack>
        {({ state }) => (
          <>
            <div className="slider-fill" style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
            <SliderThumb />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
