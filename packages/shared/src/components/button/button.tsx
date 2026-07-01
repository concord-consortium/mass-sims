import clsx from "clsx";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";
import "./button.scss";

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  /**
   * Optional log-event name fired on press. When omitted, no log event is sent.
   * Use snake_case per GA4's constraints — `useLogEvent` validates the format in dev.
   */
  action?: string;
  /** Optional parameters merged into the log event. */
  actionParams?: Record<string, unknown>;
  /**
   * Additional class names appended to `button`. Useful for one-off positioning
   * (e.g. inside a Section's tools row).
   */
  className?: string;
}

/**
 * The shared button wrapper around `react-aria-components` `Button`. Applies the
 * token-driven visual treatment, auto-emits via `useLogEvent` when `action` is
 * supplied, and forwards everything else to react-aria unchanged (`onPress`,
 * `aria-label`, `type`, …).
 *
 * `isDisabled` is intercepted, NOT forwarded: a disabled Button stays keyboard-focusable via
 * `aria-disabled` and is blocked from firing `onPress` (so keyboard users can still discover it).
 * This deliberately differs from the shared form controls (Select/Slider/Switch/…), which keep
 * react-aria's native `disabled`.
 *
 * Pattern reference for Phase 3 controls (Slider, Switch, …). See
 * infrastructure-plan.md §3 "Shared controls policy".
 */
export function Button({
  action,
  actionParams,
  onPress,
  className,
  isDisabled,
  children,
  ...rest
}: ButtonProps) {
  const logEvent = useLogEvent();
  return (
    <AriaButton
      {...rest}
      // Keep a disabled button keyboard-focusable (aria-disabled) rather than natively disabled:
      // react-aria's isDisabled renders a native `disabled` button, which drops it from the tab
      // order so keyboard users can't even discover it. We mark it aria-disabled and block
      // activation in the handler below instead.
      aria-disabled={isDisabled || undefined}
      className={clsx("button", className)}
      onPress={(e) => {
        if (isDisabled) return;
        if (action) logEvent(action, actionParams);
        onPress?.(e);
      }}
    >
      {children}
    </AriaButton>
  );
}
