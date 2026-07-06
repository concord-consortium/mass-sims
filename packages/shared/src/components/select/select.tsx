import clsx from "clsx";
import { type ReactNode, useContext, useEffect } from "react";
import {
  Select as AriaSelect,
  Button,
  type Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectStateContext,
  SelectValue,
} from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";

import "./select.scss";

/**
 * Restores click-outside-to-close and open-trigger-toggle, which react-aria only wires up for
 * *modal* popovers (via the underlay) — our `isNonModal` popover drops both. See the `isNonModal`
 * note on `<Popover>` below.
 */
function CloseOnOutsidePointer() {
  const state = useContext(SelectStateContext);
  useEffect(() => {
    if (!state?.isOpen) return;
    // Capture-phase so the close is decided before other handlers act on the same gesture.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      // A press inside the portaled list is a selection — leave it to react-aria.
      if (target?.closest?.(".select-popover")) return;
      // Our own open trigger (the only expanded one): swallow the press, else react-aria would
      // close on blur then re-open it on the same gesture. Any other press just dismisses.
      if (target?.closest?.('.react-aria-Button[aria-expanded="true"]')) {
        event.preventDefault();
        event.stopPropagation();
      }
      state.close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [state, state?.isOpen]);
  return null;
}

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
 *
 * ARIA pattern (intentional): this delegates to react-aria's `Select`, which renders a
 * `<button aria-haspopup="listbox">` trigger plus a `role="listbox"`/`role="option"` popover and
 * moves real DOM focus among options — the WAI-ARIA "collapsible listbox / button + listbox"
 * pattern. That is a deliberate, accepted deviation from the demo/spec's hand-rolled
 * `role="combobox"` + `aria-activedescendant` ("select-only combobox"). Both are valid APG patterns;
 * the react-aria one is battle-tested and keyboard-/screen-reader-complete, so it's preferred here.
 * Don't re-hand-roll a combobox to "match the demo." See docs/infrastructure-plan.md §3
 * ("Accessibility conventions & known gaps").
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
      value={selectedKey}
      defaultValue={defaultSelectedKey}
      onChange={(key) => {
        // rac can pass null (cleared selection); our public onSelectionChange is non-null and
        // logging "null" would be bogus, so ignore clears.
        if (key === null) return;
        const k = key as K;
        if (action) logEvent(action, { value: String(k), ...actionParams });
        onSelectionChange?.(k);
      }}
      placeholder={placeholder}
      className={clsx("select", className)}
    >
      <CloseOnOutsidePointer />
      {label != null ? <Label>{label}</Label> : null}
      <Button>
        <SelectValue />
        <svg className="select-caret" viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="16.59 8.59 12 13.17 7.41 8.59 6 10 12 16 18 10" />
        </svg>
      </Button>
      {/*
        offset={0} so the popover sits flush below the trigger (see select.scss).
        isNonModal so the rest of the row stays hoverable while the list is open — a modal popover
        both covers the page with a pointer-capturing underlay and marks siblings `inert`, so
        neither the open trigger nor the other parent dropdown can be hovered (can't be undone in
        CSS; hence non-modal). The trade-off — losing outside-click/toggle close — is restored by
        <CloseOnOutsidePointer> above.
      */}
      <Popover className="select-popover" offset={0} isNonModal>
        <ListBox items={options}>
          {(item: SelectOption<K>) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
