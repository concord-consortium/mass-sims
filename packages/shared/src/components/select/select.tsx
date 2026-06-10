import clsx from "clsx";
import type { ReactNode } from "react";
import {
  Select as AriaSelect,
  Button,
  type Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";

import "./select.scss";

export interface SelectOption<K extends Key = string> {
  id: K;
  label: ReactNode;
}

export interface SelectProps<K extends Key = string> {
  label?: ReactNode;
  options: readonly SelectOption<K>[];
  selectedKey?: K | null;
  defaultSelectedKey?: K;
  onSelectionChange?: (key: K) => void;
  action?: string;
  actionParams?: Record<string, unknown>;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Token-driven dropdown on `react-aria-components`'s `Select`. Auto-emits via
 * `useLogEvent` on selection change when `action` is supplied.
 */
export function Select<K extends Key = string>({
  label,
  options,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  action,
  actionParams,
  isDisabled,
  placeholder,
  className,
}: SelectProps<K>) {
  const logEvent = useLogEvent();
  return (
    <AriaSelect
      isDisabled={isDisabled}
      value={selectedKey ?? undefined}
      defaultValue={defaultSelectedKey}
      onChange={(key) => {
        const k = key as K;
        if (action) logEvent(action, { value: String(k), ...actionParams });
        onSelectionChange?.(k);
      }}
      placeholder={placeholder}
      className={clsx("select", className)}
    >
      {label != null ? <Label>{label}</Label> : null}
      <Button>
        <SelectValue />
        <svg className="select-caret" viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="16.59 8.59 12 13.17 7.41 8.59 6 10 12 16 18 10" />
        </svg>
      </Button>
      {/* offset={0} so the popover sits flush below the trigger (see select.scss). */}
      <Popover className="select-popover" offset={0}>
        <ListBox items={options}>
          {(item: SelectOption<K>) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
