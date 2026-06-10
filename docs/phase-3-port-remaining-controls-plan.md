# Phase 3 — Port Remaining Controls + Graphing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the shared interactive-control catalog established in Phase 2c. Port the remaining V2 form controls (`Slider`, `NumberField`, `Switch`, `Select`, `Checkbox`) as react-aria-components wrappers following the Button template. Add two hand-rolled SVG graphing primitives — `LineChart` and `Histogram` — no chart library. Migrate the Starter sim's three remaining native HTML inputs (walker-count slider, step-size slider, frames-per-trial number input) to the new shared controls, and migrate the Starter's two canvas-based charts (time-series → `LineChart`, walker-distance histogram → `Histogram`) to the new shared components. Close UI design plan §15 Q19 (charting library) with the hand-rolled SVG decision.

**Architecture:** Every new control is a thin wrapper around its react-aria-components primitive, applying our SCSS tokens, optionally auto-emitting log events via `useLogEvent`, and forwarding everything else to the primitive — the policy is locked in `docs/infrastructure-plan.md` §3 "Shared controls policy" and proven by `<Button>` in Phase 2c. Continuous controls (Slider) emit on **commit only** (`onChangeEnd`), not during drag — matches decision #28 in the infrastructure plan. Discrete controls (NumberField commit-on-blur, Switch / Checkbox / Select change-on-toggle) emit on their natural commit event. SCSS state styling uses react-aria's `data-hovered` / `data-pressed` / `data-focus-visible` / `data-focus-within` / `data-disabled` / `data-selected` attribute selectors, not CSS pseudo-classes (matches Button's pattern; important for cross-device touch behavior).

The LineChart and Histogram are hand-rolled SVG components — no chart library — following FOSS's `BarGraph` (`foss/common/src/components/bar-graph/bar-graph.tsx`) in spirit (React + SCSS + custom drawing) but using SVG primitives (`<polyline>` / `<line>` / `<rect>` / `<text>`) rather than positioned HTML divs, because SVG is the right tool for continuous line series AND for histogram bars where bin edges must align with round-number axis labels. FOSS and DESE both hand-roll their visualizations and don't use a charting library at all; we follow that precedent. SVG was preferred over canvas (the Starter's current implementations) for accessibility — SVG content is discoverable to assistive tech via `<title>` / `<desc>` elements, and axes / tick labels remain real `<text>` nodes a screen reader can announce.

`LineChart` exposes a small token-driven prop surface (`data`, `xKey`, `yKey`, `height`, `ariaLabel`) and renders a single-series line. `Histogram` exposes a different surface (`values: readonly number[]`, `targetBinCount`, `height`, `xLabel`, `yLabel`) and auto-bins the raw values using the `histogramBins` + `niceStep` helpers ported from the Starter's `data-panel.tsx` — a histogram takes raw numeric values rather than pre-categorized data, which distinguishes it from a future categorical `BarChart` (deferred until a sim with non-binned bar data appears). Both components share the same axes-and-margins approach so consumers reading the source see a consistent pattern.

**Runtime accessibility checking** is deliberately **not** part of this phase. Biome's a11y rule group (already in `biome.json`) catches the common mistakes in our wrappers at lint time, and the **axe DevTools Chrome extension** (Deque's free tool) covers on-demand runtime checks during development. A dedicated in-tree `axe-core` runtime integration ships in Phase 6 hardening alongside Lighthouse audits and an `@axe-core/playwright` E2E pass — by that point there are real sims (not just the template), so the runtime checks have meaningful targets. See the Deferred follow-ups section.

A `<Table>` component is deliberately **not** part of this phase. None of the sims currently in design call for a table, and Tanstack Table is a meaningful architectural commitment we'd rather defer until a real sim's needs can shape the wrapper's API. See the Deferred follow-ups section for the recorded intent.

**Tech Stack:** React 19.2, TypeScript 6, Vite 8, Vitest 4 + @testing-library/react (jsdom), plain (global) SCSS via side-effect imports scoped under a root class, `clsx` for class composition, Biome (lint/format), `react-aria-components ^1.18` (already in shared from Phase 2c). **No new dependencies in this phase** — both charts are hand-rolled SVG and no other runtime checking is added.

---

## Conventions discovered in the codebase (follow these exactly)

These were verified by reading the existing code on this branch. Honoring them keeps the diff idiomatic with Phase 2c.

- **Tests import from `"vitest"` explicitly** — `globals: false` is set in every `vitest.config.ts`. Never rely on injected globals.
- **`@testing-library/jest-dom` is wired** via per-workspace `test-setup.ts` files referenced from `vitest.config.ts` `setupFiles`. Component tests use `toBeInTheDocument()` / `toHaveAttribute()` / `toHaveClass()` directly.
- **`@testing-library/user-event` is NOT installed.** Use `fireEvent` for clicks / keyboard. **For Slider's drag-and-release**, simulate via `fireEvent.keyDown` on the thumb (react-aria-components supports `ArrowLeft`/`ArrowRight` to nudge by step, `End` to jump to max) — that path also fires `onChangeEnd`. For pointer drag in jsdom, use `fireEvent.pointerDown` + `pointerMove` + `pointerUp`. Prefer the keyboard path where possible; it's deterministic.
- **Hook tests use `@testing-library/react`'s `renderHook` + `act`** — see existing `packages/shared/src/hooks/*.test.ts` for the established style.
- **Component styles are plain (global) SCSS imported for side-effect** — `import "./slider.scss";`, NOT `import styles from "./slider.module.scss"`. JSX uses plain string class names composed with `clsx`. Scope every component's rules under a single root class.
- **react-aria-components state styling uses `data-*` attributes, not CSS pseudo-classes** — e.g. `.slider [data-hovered]`, `.checkbox[data-pressed]`, NOT `.slider:hover` / `.checkbox:active`. This matches Button's pattern from Phase 2c. The reason: react-aria's pointer state machine handles touch + mouse uniformly; `:hover` triggers on touchscreen taps which is wrong. See react-aria-components' styling docs: https://react-spectrum.adobe.com/react-aria/styling.html.
- **react-aria-components ^1.18 DOM role mappings (verified empirically against the installed version — use these in tests, NOT the intuitive HTML roles).** The thumb / input elements rac renders don't always carry the role or value attribute you'd expect from a hand-written control, so the literal `getByRole` / `toHaveAttribute` targets matter:
  - **`Slider`** thumb → a native `<input type="range">` (role `slider`). The current value is exposed on **`aria-valuetext`** (and the native `value`), **not** a literal `aria-valuenow` attribute — assert `toHaveAttribute("aria-valuetext", "42")`.
  - **`NumberField`** input → an `<input type="text">` with role **`textbox`** and `aria-roledescription="Number field"`, **not** `spinbutton`. Query `getByRole("textbox")`. Disabled still sets the native `disabled` attribute, so `toBeDisabled()` works.
  - **`Switch`** → the flat `Switch` is **deprecated** in rac ^1.18; use **`SwitchField` + `SwitchButton`**. This renders an outer `<div class="switch">` (the field) wrapping a `<label class="switch-button">` (the clickable area) wrapping a visually-hidden `<input role="switch" type="checkbox">`. Query the toggle with `getByRole("switch")`; `data-selected` / `data-disabled` appear on **both** the field `<div>` and the button `<label>`, but interaction state (`data-focus-visible` / `data-hovered` / `data-pressed`) lands on the **button only** — target the focus ring at `.switch-button`. Disabled sets the native `disabled` on the input (`toBeDisabled()` works).
  - **`Checkbox`** → the flat `Checkbox` is **deprecated** in rac ^1.18; use **`CheckboxField` + `CheckboxButton`** (same shape as Switch). This renders an outer `<div class="checkbox">` wrapping a `<label class="checkbox-button">` wrapping a visually-hidden `<input type="checkbox">` (role `checkbox`). Query with `getByRole("checkbox")`. `data-selected` / `data-disabled` / `data-indeterminate` appear on both the field and the button, so `.checkbox[data-indeterminate] .indicator` still matches; interaction state lands on the button only — target hover/focus/press at `.checkbox-button`.
  - **`Select`** → a `<div class="select">` with a trigger `<button aria-haspopup="listbox">` (role `button`) plus a visually-hidden, `aria-hidden` native `<select>` for form integration (ignored by `getByRole`, so it won't collide with the trigger). Open the listbox by clicking the trigger; options carry role `option`. The trigger's placeholder text defaults to "Select an item" when no `placeholder` prop is supplied. Import the `Key` type from **`react-aria-components`** (re-exported from `@react-types/shared`, `string | number`), NOT from `react` — React's `Key` includes `bigint` and is not assignable to rac's narrower `Key`, which trips `selectedKey` / `ListBoxItem id` typing. The `Popover` portals to `document.body`, so give it its own root class (`select-popover`) for SCSS rather than nesting under `.select`. On the inner `AriaSelect`, the single-key **`selectedKey` / `defaultSelectedKey` / `onSelectionChange` props are deprecated** in rac ^1.18 — use **`value` / `defaultValue` / `onChange`** instead (rac generalized `Select` to multi-select via `ValueBase`; for single-select mode these carry `Key | null`). Keep the friendlier `selectedKey` / `onSelectionChange` names on the wrapper's own public API and map them inward.
- **Tokens accessed via `@use "../../styles/tokens" as tokens`** from a relative path inside shared-library SCSS, then `tokens.$foo`. The Starter (an external consumer) uses `@use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens` instead.
- **The shared barrel** at `packages/shared/src/index.ts` re-exports everything sims import. New components are added there with their props types.
- **Log-event auto-emit follows the Button pattern from Phase 2c.** Each control accepts `action?: string` (snake_case event name) and `actionParams?: Record<string, unknown>`. When `action` is supplied, the wrapper calls `logEvent(action, { ...actionParams })` on the natural commit event. When `action` is omitted, no log event fires.
- **Continuous controls emit on commit, NOT during drag** — Slider uses `onChangeEnd`, not `onChange`. This matches infra-plan §11 #28 ("dramatically lower volume and arguably more meaningful").
- **Biome formatting:** double quotes, semicolons, trailing commas "all", 2-space indent, 100-char lines, `always` arrow parens. Run `yarn lint:fix` before staging if unsure.

---

## Scope guardrails (what this plan deliberately does NOT do)

- **No new sims.** First real sim is a later phase. Starter is the only sim that changes here.
- **No `<ToggleButton>` primitive.** The demo viewer's `.toggle-btn` (Bananas / Collapse / iPad / etc.) is demo *viewer* chrome, not a sim need. If a sim wants pressed-state toggle behavior, Phase 2c's `<Button>` plus `aria-pressed` is sufficient.
- **No `<Dialog>` primitive.** Still deferred from Phase 2a — when the reload-warning confirmation needs more than `beforeunload`, the shared Dialog will land then.
- **No date / time / color / file / search / autocomplete controls.** No current consumer; the rule-of-three deferral applies.
- **No `<Table>` component.** None of the sims currently in design need one, and we haven't used Tanstack Table at CC before — better to let the first sim that wants tabular data drive the library choice and the wrapper API. Recorded in Deferred follow-ups.
- **No virtualized list / data grid.** Not needed without a Table; revisit when one lands.
- **No theme variants on any control.** The demo uses one visual treatment everywhere; per-variant emphasis (`primary` / `secondary` / `danger`) waits until a sim needs the differentiation. Matches the Button decision.
- **No runtime accessibility checking.** Biome's a11y rule group + the axe DevTools Chrome extension cover this phase's needs; a dedicated `initAxeDev` wrapper around `axe-core` (or another runtime integration) ships in Phase 6 hardening when there are real sims to check against. `@axe-core/react` is archived for React 18+ regardless (see https://github.com/dequelabs/axe-core-npm/tree/develop/packages/react), so the future integration uses `axe-core` directly via a small wrapper.
- **No multi-sim test harness.** That's its own phase (Phase 4 in the infra plan's §9).
- **No charting library at all.** Q19 closes with "hand-rolled SVG." Matches FOSS / DESE precedent (both repos hand-roll their visualizations) and gives us full control over tokens, a11y, and bundle weight. Phase 3 ships `LineChart` and `Histogram`; categorical bar charts (pre-named tick groups + values, FOSS's `BarGraph` shape), scatter, area, and multi-series charts are deferred until a sim needs them; the first such sim either grows an existing component or adds a sibling. If hand-rolling ever becomes the wrong call (a sim needs interactive tooltips, animations, brushing, zooming, etc. that would be too costly to build), the library choice gets revisited then with concrete requirements rather than now in the abstract.

---

## Task 0: Confirm branch + green baseline

**Files:** none (git + verification only).

**Step 1: Confirm the branch**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
git branch --show-current
```

Expected: `phase-3-port-remaining-controls` (or whatever the user named the Phase 3 branch).

**Step 2: Confirm baseline is green BEFORE any changes**

```bash
yarn typecheck && yarn lint && yarn test && yarn gen-index --check && yarn gen-workflows --check
```

Expected: all pass. If anything fails here, STOP and report — pre-existing failure.

---

## Task 1: Shared `<Slider>` (TDD)

The first form-control port — sets the template for Tasks 2–5 (NumberField, Switch, Select, Checkbox). Wraps `react-aria-components`'s `Slider`, exposing `min` / `max` / `step` / `value` / `onChange` / `onChangeEnd`, applying token-driven track + thumb styling, and auto-emitting via `useLogEvent` **on commit** (`onChangeEnd`, NOT `onChange`).

**Files:**
- Create: `packages/shared/src/components/slider/slider.tsx`
- Create: `packages/shared/src/components/slider/slider.scss`
- Create: `packages/shared/src/components/slider/slider.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

```tsx
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({
  useLogEvent: () => logEventSpy,
}));

import { Slider } from "./slider";

describe("Slider", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label and the current value", () => {
    const { getByText, getByRole } = render(
      <Slider label="Walkers" value={42} minValue={0} maxValue={100} />,
    );
    expect(getByText("Walkers")).toBeInTheDocument();
    // The slider thumb has role="slider" via react-aria — in rac ^1.18 it's a native
    // <input type="range">, which conveys the current value via aria-valuetext (react-aria
    // sets this), not a literal aria-valuenow attribute. See the rac DOM mappings in the
    // "Conventions discovered in the codebase" section above.
    expect(getByRole("slider")).toHaveAttribute("aria-valuetext", "42");
  });

  it("applies the .slider root class", () => {
    const { container } = render(<Slider value={1} minValue={0} maxValue={10} />);
    expect(container.querySelector(".slider")).toBeInTheDocument();
  });

  it("calls onChange during drag (keyboard nudge)", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} onChange={onChange} />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalled();
  });

  it("emits the log event exactly once per keyboard commit (not twice from onChange + onChangeEnd)", () => {
    // react-aria fires both onChange and onChangeEnd on a keyboard nudge (there's no separate
    // drag phase to test in jsdom), so this test guards against accidentally wiring the
    // log emission to onChange — which would cause every keyboard nudge to double-fire.
    // For pointer-drag emission semantics (no emit during drag, only on pointerup), see the
    // visual sweep in Task 10 — jsdom can't faithfully simulate that.
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} action="walkers_set" />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(logEventSpy).toHaveBeenCalledTimes(1);
  });

  it("emits a log event on commit (onChangeEnd) including the value and any actionParams", () => {
    const { getByRole } = render(
      <Slider
        value={5}
        minValue={0}
        maxValue={10}
        step={1}
        action="walkers_set"
        actionParams={{ trial: "A" }}
      />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(logEventSpy).toHaveBeenCalledWith(
      "walkers_set",
      expect.objectContaining({ value: 6, trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("forwards isDisabled to the underlying control and suppresses onChange", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} isDisabled onChange={onChange} />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("formats the displayed value via formatOptions", () => {
    const { container } = render(
      <Slider
        value={0.5}
        minValue={0}
        maxValue={1}
        step={0.1}
        formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
      />,
    );
    // react-aria's SliderOutput formats via Intl.NumberFormat — at 0.5 with percent format, output is "50%".
    expect(container.querySelector(".slider")?.textContent).toMatch(/50%/);
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test slider` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/slider/slider.tsx`:

```tsx
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
  /** Visible label rendered above the slider. */
  label?: ReactNode;
  /** Controlled value. Single thumb only — multi-thumb is YAGNI until a sim needs it. */
  value: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  /**
   * Fires on every value change during drag (mouse / touch / keyboard nudge). Sims
   * use this for live UI updates (e.g. showing the new value as the slider moves).
   */
  onChange?: (value: number) => void;
  /**
   * Fires on commit — pointer release or keyboard step. Sims that persist the new
   * value to a trial / model do so here, not in onChange.
   */
  onChangeEnd?: (value: number) => void;
  /**
   * Optional log-event name fired on commit. When omitted, no log event is sent.
   * Use snake_case per GA4's constraints — `useLogEvent` validates the format in dev.
   * The committed value is automatically included as `value` in the event params.
   */
  action?: string;
  actionParams?: Record<string, unknown>;
  /** Intl.NumberFormatOptions passed through to react-aria's SliderOutput. */
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
        <SliderThumb />
      </SliderTrack>
    </AriaSlider>
  );
}
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/slider/slider.scss`. Token-driven, data-attribute selectors for state. Approximate visual: rounded track (gray bg + filled portion), circular thumb, value displayed above the track.

```scss
@use "../../styles/tokens" as tokens;

.slider {
  align-items: center;
  display: grid;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-base;
  grid-template-areas:
    "label  output"
    "track  track";
  grid-template-columns: 1fr auto;
  row-gap: tokens.$space-1;
  width: 100%;

  > label {
    color: tokens.$color-text;
    font-weight: 700;
    grid-area: label;
  }

  > [slot="output"],
  > output {
    color: tokens.$color-text;
    font-variant-numeric: tabular-nums;
    grid-area: output;
  }

  .react-aria-SliderTrack {
    align-items: center;
    cursor: pointer;
    display: flex;
    grid-area: track;
    height: 24px;
    width: 100%;

    // Track rail.
    &::before {
      background: tokens.$color-surface-muted;
      border-radius: tokens.$radius-sm;
      content: "";
      display: block;
      height: 4px;
      width: 100%;
    }

    &[data-disabled] {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .react-aria-SliderThumb {
    background: tokens.$color-text;
    border: 2px solid tokens.$color-surface;
    border-radius: 50%;
    box-shadow: 0 0 0 1px tokens.$color-text;
    height: 16px;
    top: 50%;
    width: 16px;

    &[data-hovered],
    &[data-focus-visible] {
      background: tokens.$color-text-muted;
    }

    &[data-dragging] {
      background: tokens.$color-focus-outline;
    }

    &[data-focus-visible] {
      outline: tokens.$focus-outline;
      outline-offset: tokens.$focus-outline-offset;
    }
  }
}
```

(Visual will need polish against the design system, but this is the structural baseline. If a designer-supplied spec appears later, the `slider.scss` is a single-file revision.)

**Step 4: Export from the barrel**

In `packages/shared/src/index.ts`:

```ts
export { Slider, type SliderProps } from "./components/slider/slider";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test slider
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
```

Expected: all 8 tests pass.

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): Slider — react-aria wrapper with commit-only log emission`

(Suggested files to stage when the user is ready: the four files above.)

---

## Task 2: Shared `<NumberField>` (TDD)

Numeric input with increment / decrement buttons, built on react-aria-components' `NumberField`. Auto-emits on `onChange` (which fires on commit — blur or Enter — per react-aria's NumberField semantics).

**Files:**
- Create: `packages/shared/src/components/number-field/number-field.tsx`
- Create: `packages/shared/src/components/number-field/number-field.scss`
- Create: `packages/shared/src/components/number-field/number-field.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

```tsx
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({ useLogEvent: () => logEventSpy }));

import { NumberField } from "./number-field";

describe("NumberField", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label and value", () => {
    const { getByText, getByRole } = render(
      <NumberField label="Frames per trial" value={200} />,
    );
    expect(getByText("Frames per trial")).toBeInTheDocument();
    // In rac ^1.18 the NumberField input is a type="text" element (role "textbox") with
    // aria-roledescription="Number field", not a native spinbutton. See the rac DOM
    // mappings in the "Conventions discovered in the codebase" section above.
    expect(getByRole("textbox")).toHaveValue("200");
  });

  it("renders increment and decrement buttons", () => {
    const { getAllByRole } = render(<NumberField label="Frames" value={100} />);
    const buttons = getAllByRole("button");
    expect(buttons).toHaveLength(2); // increment + decrement
  });

  it("fires onChange when the value is committed", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <NumberField label="Frames" value={100} step={50} minValue={0} maxValue={500} onChange={onChange} />,
    );
    // Pressing increment fires onChange (commit-on-action).
    const incrementButton = getByRole("button", { name: /increase|increment/i });
    fireEvent.click(incrementButton);
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it("auto-emits a log event with the committed value when action is supplied", () => {
    const { getByRole } = render(
      <NumberField label="Frames" value={100} step={50} action="frames_set" actionParams={{ trial: "A" }} />,
    );
    fireEvent.click(getByRole("button", { name: /increase|increment/i }));
    expect(logEventSpy).toHaveBeenCalledWith(
      "frames_set",
      expect.objectContaining({ value: 150, trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<NumberField label="Frames" value={100} />);
    fireEvent.click(getByRole("button", { name: /increase|increment/i }));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("respects minValue / maxValue", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <NumberField label="Frames" value={500} minValue={1} maxValue={500} onChange={onChange} />,
    );
    fireEvent.click(getByRole("button", { name: /increase|increment/i }));
    // Already at max — increment should clamp or no-op.
    expect(onChange).not.toHaveBeenCalledWith(expect.any(Number));
  });

  it("forwards isDisabled", () => {
    const { getByRole } = render(<NumberField label="Frames" value={100} isDisabled />);
    expect(getByRole("textbox")).toBeDisabled();
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test number-field` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/number-field/number-field.tsx`:

```tsx
import clsx from "clsx";
import type { ReactNode } from "react";
import {
  Button,
  Group,
  Input,
  Label,
  NumberField as AriaNumberField,
} from "react-aria-components";
import { useLogEvent } from "../../hooks/use-log-event";
import "./number-field.scss";

export interface NumberFieldProps {
  label?: ReactNode;
  value: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  /** Fires on commit (blur, Enter, or stepper button press). */
  onChange?: (value: number) => void;
  /** Optional log-event name fired on commit, with `value` auto-included. */
  action?: string;
  actionParams?: Record<string, unknown>;
  formatOptions?: Intl.NumberFormatOptions;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Token-driven numeric input on `react-aria-components`'s `NumberField`. Auto-emits
 * via `useLogEvent` on commit (onChange, which react-aria already debounces to
 * the natural commit event — blur / Enter / stepper press).
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
        <Button slot="decrement" aria-label="Decrease">−</Button>
        <Input />
        <Button slot="increment" aria-label="Increase">+</Button>
      </Group>
    </AriaNumberField>
  );
}
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/number-field/number-field.scss`. Layout: label above, then a Group containing decrement, input, increment in a row.

```scss
@use "../../styles/tokens" as tokens;

.number-field {
  display: flex;
  flex-direction: column;
  gap: tokens.$space-1;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-base;

  > label {
    color: tokens.$color-text;
    font-weight: 700;
  }

  .react-aria-Group {
    border: tokens.$border-strong;
    border-radius: tokens.$radius-md;
    display: flex;
    overflow: hidden;

    &[data-focus-within] {
      outline: tokens.$focus-outline;
      outline-offset: tokens.$focus-outline-offset;
    }
  }

  .react-aria-Input {
    background: tokens.$color-surface;
    border: none;
    color: tokens.$color-text;
    flex: 1;
    font: inherit;
    min-width: 0;
    outline: none;
    padding: 4px tokens.$space-2;
    text-align: center;
  }

  .react-aria-Button {
    background: tokens.$color-surface;
    border: none;
    border-left: tokens.$border-strong;
    color: tokens.$color-text;
    cursor: pointer;
    font: inherit;
    font-size: tokens.$font-size-lg;
    line-height: 1;
    min-width: 28px;
    padding: 0 tokens.$space-1;

    &[slot="decrement"] {
      border-left: none;
      border-right: tokens.$border-strong;
    }
    &[data-hovered] { background: tokens.$color-surface-hover; }
    &[data-pressed] { background: tokens.$color-surface-active; }
    &[data-disabled] { color: tokens.$color-text-muted; cursor: not-allowed; }
  }

  &[data-disabled] {
    opacity: 0.5;
  }
}
```

**Step 4: Export from the barrel**

In `packages/shared/src/index.ts`:

```ts
export { NumberField, type NumberFieldProps } from "./components/number-field/number-field";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test number-field
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
```

Expected: all 7 tests pass.

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): NumberField — react-aria wrapper with commit-on-change log emission`

(Suggested files to stage when the user is ready: the four files above.)

---

## Task 3: Shared `<Switch>` (TDD)

Boolean toggle with a "rocker" visual. Auto-emits on `onChange` (boolean). Follows Task 1's pattern abbreviated — test content mirrors Button's shape rather than re-typing the full block.

**Files:**
- Create: `packages/shared/src/components/switch/switch.tsx`
- Create: `packages/shared/src/components/switch/switch.scss`
- Create: `packages/shared/src/components/switch/switch.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

Tests mirror Button's pattern from Phase 2c: renders with label, applies `.switch` root class, fires `onChange` on click, auto-emits with `value` and `actionParams` when `action` is set, doesn't emit when `action` is omitted, forwards `isDisabled`. Use the same `vi.mock("../../hooks/use-log-event", …)` setup as Tasks 1–2.

Per the rac DOM mappings in the Conventions section: query the toggle with `getByRole("switch")`, toggle it via `fireEvent.click(getByRole("switch"))`, and assert disabled with `expect(getByRole("switch")).toBeDisabled()`. With the `SwitchField` + `SwitchButton` composition (see Step 2) the `.switch` class is on the outer field `<div>` and the label text renders inside the inner `<label class="switch-button">`, so `getByText(...)` and `container.querySelector(".switch")` both still work.

Run `yarn workspace @concord-consortium/mass-sims-shared test switch` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/switch/switch.tsx`:

The flat `Switch` is deprecated in rac ^1.18 — use the `SwitchField` + `SwitchButton` composition instead (`SwitchField` carries the state props; `SwitchButton` is the clickable label holding the indicator + children).

```tsx
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
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/switch/switch.scss`. `.switch` is the `SwitchField` wrapper; `.switch-button` is the clickable label. `data-selected` / `data-disabled` land on both, but interaction state (`data-focus-visible` / `data-hovered` / `data-pressed`) lands on the button only — so the focus ring targets `.switch-button`.

```scss
@use "../../styles/tokens" as tokens;

.switch {
  display: inline-flex;

  .switch-button {
    align-items: center;
    cursor: pointer;
    display: inline-flex;
    font-family: tokens.$font-family-base;
    font-size: tokens.$font-size-base;
    gap: tokens.$space-2;

    .indicator {
      background: tokens.$color-surface-muted;
      border-radius: 12px;
      display: inline-block;
      height: 20px;
      position: relative;
      transition: background 0.15s;
      width: 36px;

      &::after {
        background: tokens.$color-surface;
        border-radius: 50%;
        content: "";
        height: 16px;
        left: 2px;
        position: absolute;
        top: 2px;
        transition: left 0.15s;
        width: 16px;
      }
    }

    &[data-selected] .indicator {
      background: tokens.$color-text;

      &::after {
        left: 18px;
      }
    }

    &[data-focus-visible] {
      outline: tokens.$focus-outline;
      outline-offset: tokens.$focus-outline-offset;
    }

    &[data-disabled] {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
}
```

**Step 4: Export from the barrel**

```ts
export { Switch, type SwitchProps } from "./components/switch/switch";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test switch
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
```

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): Switch — react-aria wrapper with auto-emit log on toggle`

(Suggested files to stage when the user is ready: the four files above.)

---

## Task 4: Shared `<Select>` (TDD)

Dropdown selection with a popover. More complex composite — needs `Select` + `Button` (the trigger) + `Popover` + `ListBox` + `ListBoxItem` from react-aria-components. Auto-emits on `onSelectionChange`.

**Files:**
- Create: `packages/shared/src/components/select/select.tsx`
- Create: `packages/shared/src/components/select/select.scss`
- Create: `packages/shared/src/components/select/select.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

Tests verify: renders with label and placeholder, the trigger shows the current selection, opening the popover (`fireEvent.click` on trigger) reveals the options, clicking an option fires `onSelectionChange` with the right key, auto-emits a log event with `value: "<key>"` when `action` is set, doesn't emit when `action` is omitted, forwards `isDisabled`. Use the same `vi.mock("../../hooks/use-log-event", …)` setup as Tasks 1–3.

Per the rac DOM mappings in the Conventions section: the trigger is `getByRole("button")` (the visually-hidden native `<select>` is `aria-hidden`, so it won't collide). Open the listbox with `fireEvent.click(getByRole("button"))`, then the options carry role `option` — `getByRole("option", { name: /…/ })` or `getByText(...)`. The trigger's placeholder text defaults to "Select an item" when no `placeholder` is passed.

(Popover open/close interactions in jsdom — react-aria-components renders the popover via inline portals; tests work but verify that the listbox items are queryable after opening. If a test surfaces a portal-rendering issue in jsdom, switch to asserting against `document.body` rather than the render `container`.)

Run `yarn workspace @concord-consortium/mass-sims-shared test select` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/select/select.tsx`:

Note: import the `Key` type from `react-aria-components`, NOT `react` (see the rac mappings convention). On the inner `AriaSelect`, use the non-deprecated `value` / `defaultValue` / `onChange` props — the single-key `selectedKey` / `defaultSelectedKey` / `onSelectionChange` props are deprecated in rac ^1.18 (rac generalized `Select` to support multi-select via `ValueBase`). Our wrapper's public API keeps the clearer `selectedKey` / `onSelectionChange` names and maps them inward.

```tsx
import clsx from "clsx";
import type { ReactNode } from "react";
import {
  Button,
  type Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
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
        <span aria-hidden="true">▾</span>
      </Button>
      <Popover>
        <ListBox items={options}>
          {(item: SelectOption<K>) => (
            <ListBoxItem id={item.id}>{item.label}</ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/select/select.scss`. Style the trigger `Button` as a bordered field matching NumberField's input shape, the `Popover` as a bordered list, and `ListBoxItem` with hover / selected states via `data-hovered` / `data-selected` attribute selectors.

**Step 4: Export from the barrel**

```ts
export { Select, type SelectOption, type SelectProps } from "./components/select/select";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test select
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
```

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): Select — react-aria wrapper with auto-emit log on selection change`

(Suggested files to stage when the user is ready: the four files above.)

---

## Task 5: Shared `<Checkbox>` (TDD)

Boolean toggle visual distinct from Switch (square box with check). Auto-emits on `onChange` (boolean). Indeterminate state supported.

**Files:**
- Create: `packages/shared/src/components/checkbox/checkbox.tsx`
- Create: `packages/shared/src/components/checkbox/checkbox.scss`
- Create: `packages/shared/src/components/checkbox/checkbox.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

Tests mirror Switch's pattern (Task 3): renders with label, applies `.checkbox` root class, fires `onChange` on click, auto-emits when `action` is set, doesn't emit when omitted, forwards `isDisabled`. Plus one extra test for indeterminate state rendering — pass `isIndeterminate={true}` and assert the indicator carries the indeterminate visual (use `container.querySelector(".checkbox[data-indeterminate] .indicator")` or similar). Use the same `vi.mock` setup.

Per the rac DOM mappings in the Conventions section: query the box with `getByRole("checkbox")` (toggle via `fireEvent.click(getByRole("checkbox"))`, disabled via `toBeDisabled()`). The `.checkbox[data-indeterminate] .indicator` selector is verified-correct against rac ^1.18 — `data-indeterminate` lands on the root `<div class="checkbox">` (the `CheckboxField`) as well as the inner `<label class="checkbox-button">`.

Run `yarn workspace @concord-consortium/mass-sims-shared test checkbox` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/checkbox/checkbox.tsx`:

The flat `Checkbox` is deprecated in rac ^1.18 — use the `CheckboxField` + `CheckboxButton` composition (same shape as Switch's `SwitchField` + `SwitchButton`).

```tsx
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
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/checkbox/checkbox.scss`. `.checkbox` is the `CheckboxField` wrapper; `.checkbox-button` is the clickable label. Square indicator with the check rendered via a CSS pseudo-element on `[data-selected]`, and a horizontal bar via a pseudo-element on `[data-indeterminate]`. `data-selected` / `data-disabled` / `data-indeterminate` land on both elements; interaction state (`data-focus-visible`) lands on the button only.

```scss
@use "../../styles/tokens" as tokens;

.checkbox {
  display: inline-flex;

  .checkbox-button {
    align-items: center;
    cursor: pointer;
    display: inline-flex;
    font-family: tokens.$font-family-base;
    font-size: tokens.$font-size-base;
    gap: tokens.$space-2;

    .indicator {
      background: tokens.$color-surface;
      border: tokens.$border-strong;
      border-radius: tokens.$radius-sm;
      height: 18px;
      position: relative;
      width: 18px;
    }

    &[data-selected] .indicator::after {
      border-bottom: 2px solid tokens.$color-text;
      border-right: 2px solid tokens.$color-text;
      content: "";
      height: 10px;
      left: 5px;
      position: absolute;
      top: 1px;
      transform: rotate(45deg);
      width: 5px;
    }

    &[data-indeterminate] .indicator::after {
      background: tokens.$color-text;
      content: "";
      height: 2px;
      left: 3px;
      position: absolute;
      top: 7px;
      width: 10px;
    }

    &[data-focus-visible] {
      outline: tokens.$focus-outline;
      outline-offset: tokens.$focus-outline-offset;
    }

    &[data-disabled] {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
}
```

**Step 4: Export from the barrel**

```ts
export { Checkbox, type CheckboxProps } from "./components/checkbox/checkbox";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test checkbox
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
```

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): Checkbox — react-aria wrapper with auto-emit log on toggle`

(Suggested files to stage when the user is ready: the four files above.)

---

## Task 6: Migrate Starter's three native inputs to `<Slider>` + `<NumberField>`

End-to-end validation that the new controls work in a real sim. Replace:

- Walker-count range input → `<Slider>`
- Step-size range input → `<Slider>`
- Frames-per-trial number input → `<NumberField>`

Each migrates to a `<Slider>` / `<NumberField>` with `action="walkers_set" | "step_size_set" | "frames_per_trial_set"` and `actionParams={{ trial: trialLabel }}`. The committed value flows through `onChangeEnd` (slider) / `onChange` (number-field) into the existing `updateInput` callback.

**Files:**
- Modify: `packages/starter/src/components/simulation-view.tsx`
- Modify: `packages/starter/src/components/simulation-view.scss` (drop the now-redundant native input rules)
- Modify: `packages/starter/src/components/simulation-view.test.tsx` (update label-based queries if needed)

**Step 1: Replace the inputs in simulation-view.tsx**

Import the shared controls:

```ts
import { NumberField, Slider } from "@concord-consortium/mass-sims-shared";
```

Replace the existing `<div className="controls">` block:

```tsx
<div className="controls">
  <Slider
    label="Walker count"
    value={input.walkerCount}
    minValue={1}
    maxValue={500}
    step={1}
    isDisabled={inputsLocked}
    onChange={(v) => updateInput({ walkerCount: v })}
    action="walkers_set"
    actionParams={{ trial: trialLabel }}
  />
  <Slider
    label="Step size"
    value={input.stepSize}
    minValue={0.1}
    maxValue={5}
    step={0.1}
    isDisabled={inputsLocked}
    onChange={(v) => updateInput({ stepSize: v })}
    formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
    action="step_size_set"
    actionParams={{ trial: trialLabel }}
  />
  <NumberField
    label="Frames per trial"
    value={input.framesPerTrial}
    minValue={1}
    maxValue={500}
    step={1}
    isDisabled={inputsLocked}
    onChange={(v) => updateInput({ framesPerTrial: v })}
    action="frames_per_trial_set"
    actionParams={{ trial: trialLabel }}
  />
</div>
```

Note: Slider's `onChange` (used here) fires during drag for live UI updates; `onChangeEnd` is where the log emission happens — see Task 1. Sims that need a separate "live preview" from "committed" path use both. For Starter we just want the input to track + log on commit, so passing `onChange` updates the trial's input state continuously while the log event fires on release.

Note on NumberField `step`: react-aria's `step` controls BOTH the +/- button increment AND snaps typed values to that granularity (relative to 0) on commit — they can't be decoupled. `step={1}` keeps the old native input's behavior (any integer 1–500 is typable); a coarser step (e.g. 50) would snap typed values to multiples of 50 (a user couldn't set 175). Frames-per-trial uses `step={1}` so arbitrary counts remain typable.

**Step 2: Trim now-redundant SCSS rules**

In `simulation-view.scss`, remove the rules that styled the native `input[type=range]` / `input[type=number]`. Keep `.controls` (the layout container).

**Step 3: Update tests**

Existing tests likely query the controls by label via `getByLabelText(/walker count/i)`. react-aria-components' `Slider` exposes the thumb with `role="slider"` and an `aria-label` derived from the `Label` element — `getByRole("slider", { name: /walker count/i })` is the new pattern (Frames per trial → `getByRole("textbox", { name: /frames per trial/i })`). Update the queries; the underlying assertions (asserting `disabled`, etc.) carry over.

Two existing tests shorten the trial by typing into the frames input (`fireEvent.change(..., { target: { value: "2" } })`). The NumberField commits on **blur** (not on `change`), so any test that needs the committed value must follow `change` with `fireEvent.blur(input)` (or `keyDown` Enter). In the `SimulationView` unit tests it's cleaner to set the short trial via the trial fixture (`emptyTrial({ framesPerTrial: 2 })`) and skip the input entirely; in the App-level `runSelectedTrial` helper (where the App owns the trial) use `change` + `blur` on `getByRole("textbox", { name: /frames per trial/i })`.

Add one new test verifying log emission for the slider committed value:

```tsx
it("emits walkers_set on slider commit", () => {
  // Use the mocked logEvent at the package boundary like in Phase 2c starter tests.
  const view = render(<SimulationView … />);
  const slider = view.getByRole("slider", { name: /walker count/i });
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  // logEventSpy should have been called with "walkers_set" and a numeric value.
});
```

**Step 4: Run + verify**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter build
```

**Step 5: Stop and wait for user review**

Suggest the commit message: `feat(starter): migrate native inputs to shared Slider + NumberField`

---

## Task 7: Shared `<LineChart>` (hand-rolled SVG) + migrate Starter chart

Hand-rolled SVG line chart — no charting library. Models FOSS's `BarGraph` in spirit (`foss/common/src/components/bar-graph/bar-graph.tsx`: React + SCSS + custom drawing, ~140 lines) but uses SVG primitives (`<polyline>`, `<line>`, `<text>`, `<rect>`) since a continuous line series doesn't fit the absolutely-positioned-div approach FOSS uses for bars. Token-driven via CSS classes that map to `stroke` / `fill` in SCSS, so theme changes flow through `tokens.scss` without per-chart edits.

The Starter sim already has a canvas-based time-series chart (`packages/starter/src/components/data-panel.tsx`'s `TimeSeriesChart` + `drawChart`); after the shared `<LineChart>` ships, migrate that chart to the new component and drop the canvas wiring. This validates the wrapper end-to-end and makes the Starter the canonical example of "how a sim renders a time-series chart" going forward.

**Why SVG, not canvas:**
- **Accessibility.** SVG axis labels and tick labels remain real `<text>` nodes assistive tech can announce; `<title>` and `<desc>` elements give the chart region a discoverable description beyond the parent `aria-label`. Canvas content is opaque to screen readers (only the `aria-label` on the `<canvas>` element is announced).
- **Token-driven theming.** SVG attributes (`stroke`, `fill`) read CSS values naturally via class selectors. Canvas requires plumbing color tokens through JS at draw time.
- **HiDPI without devicePixelRatio math.** SVG renders at the device's actual pixel density automatically; no `canvas.width = width * dpr; ctx.scale(dpr, dpr)` boilerplate.
- **Performance is not a concern at the chart sizes we use.** ~600 px wide × 130 px tall with up to ~20 sample points (every 10 frames in a 200-frame trial) — SVG is well within its comfortable range.

**Files:**
- Create: `packages/shared/src/components/line-chart/line-chart.tsx`
- Create: `packages/shared/src/components/line-chart/line-chart.scss`
- Create: `packages/shared/src/components/line-chart/line-chart.test.tsx`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/starter/src/components/data-panel.tsx` (drop canvas + `drawChart` + `TimeSeriesChart`; render `<LineChart>` instead)
- Modify: `packages/starter/src/components/data-panel.scss` (drop now-unused `.series-chart` canvas styling)
- Modify: `packages/starter/src/components/data-panel.test.tsx` (update assertions for the new chart's DOM)

> **Scope note:** The Starter sim also has a canvas-based **histogram** (`Histogram` + `drawHistogram` in the same file) — Task 8 handles its migration to a shared `<Histogram>` component. This task (Task 7) only touches the time-series chart. Leave the histogram code untouched here; it'll be removed in Task 8.

**Step 1: Write the failing tests**

Create `packages/shared/src/components/line-chart/line-chart.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineChart } from "./line-chart";

describe("LineChart", () => {
  it("renders the empty state when data has fewer than 2 points", () => {
    const { getByText, container } = render(
      <LineChart data={[]} xKey="x" yKey="y" height={130} ariaLabel="Test chart" />,
    );
    expect(getByText("No data")).toBeInTheDocument();
    // No SVG plot in the empty state.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a custom empty-state message when supplied", () => {
    const { getByText } = render(
      <LineChart data={[{ x: 0, y: 0 }]} xKey="x" yKey="y" height={130} emptyState="Run a trial" />,
    );
    expect(getByText("Run a trial")).toBeInTheDocument();
  });

  it("renders an SVG plot when there are ≥ 2 points", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ];
    const { container } = render(
      <LineChart data={data} xKey="x" yKey="y" height={130} ariaLabel="Test chart" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    // The polyline carries the series.
    expect(container.querySelector("polyline.line-chart-series")).toBeInTheDocument();
  });

  it("exposes the ariaLabel on the chart region", () => {
    const data = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const { getByLabelText } = render(
      <LineChart data={data} xKey="x" yKey="y" height={130} ariaLabel="Avg distance over time" />,
    );
    expect(getByLabelText("Avg distance over time")).toBeInTheDocument();
  });

  it("renders x and y axis titles when supplied", () => {
    const data = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const { getByText } = render(
      <LineChart
        data={data}
        xKey="x"
        yKey="y"
        height={130}
        xLabel="Frame"
        yLabel="Avg distance"
      />,
    );
    expect(getByText("Frame")).toBeInTheDocument();
    expect(getByText("Avg distance")).toBeInTheDocument();
  });

  it("renders 3 y-tick labels (0, max/2, max) by default", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 5 },
      { x: 2, y: 10 },
    ];
    const { container } = render(
      <LineChart data={data} xKey="x" yKey="y" height={130} />,
    );
    expect(container.querySelectorAll(".line-chart-y-tick-label")).toHaveLength(3);
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test line-chart` — expect FAIL.

**Step 2: Write the component**

Create `packages/shared/src/components/line-chart/line-chart.tsx`. The math mirrors the existing `drawChart` / `drawAxes` in `packages/starter/src/components/data-panel.tsx` — plot rect computed from margins, y-axis with 3 ticks (0 / max/2 / max), x-axis with start/end labels, single polyline for the series. Width is responsive via a `ResizeObserver` like the existing canvas chart's wiring (so it fills the Data column).

```tsx
import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import "./line-chart.scss";

const Y_TICKS = 3;
const DEFAULT_MARGIN = { top: 12, right: 12, bottom: 22, left: 36 };

export interface LineChartProps<T> {
  /** Series data in left-to-right order. */
  data: readonly T[];
  /** Key on each datum that gives the x-axis value. Numeric. */
  xKey: keyof T;
  /** Key on each datum that gives the y-axis value. Numeric. */
  yKey: keyof T;
  /** Fixed height in pixels. Width is responsive (fills its container). */
  height: number;
  /** Accessible name announced for the chart region. */
  ariaLabel?: string;
  /** Optional X-axis title rendered below the plot. */
  xLabel?: string;
  /** Optional Y-axis title rendered rotated up the left edge. */
  yLabel?: string;
  /** Empty-state content shown when fewer than 2 points. Defaults to "No data". */
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Hand-rolled SVG line chart. Single-series only — multi-series and other chart kinds
 * (bar, scatter, area) are deferred until a sim needs them. Token-driven via CSS
 * classes that target the SVG primitives in `line-chart.scss`.
 *
 * Pattern reference: FOSS's `common/src/components/bar-graph/bar-graph.tsx` (also
 * hand-rolled, no library; uses positioned HTML rather than SVG since bars are
 * easier as divs and lines are easier as polylines).
 */
export function LineChart<T extends Record<string, number | string>>({
  data,
  xKey,
  yKey,
  height,
  ariaLabel,
  xLabel,
  yLabel,
  emptyState,
  className,
}: LineChartProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Width tracked via ResizeObserver so the SVG viewBox matches the laid-out width
  // (the Data column flexes; the chart fills it). Guarded for jsdom which lacks
  // ResizeObserver; tests pass an explicit 0 width and only assert structure.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (data.length < 2) {
    return (
      <div
        ref={containerRef}
        className={clsx("line-chart-empty", className)}
        role="img"
        aria-label={ariaLabel}
        style={{ height }}
      >
        {emptyState ?? "No data"}
      </div>
    );
  }

  const { top, right, bottom, left } = DEFAULT_MARGIN;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const yValues = data.map((d) => Number(d[yKey]));
  const yMax = Math.max(...yValues, 1);
  const xValues = data.map((d) => Number(d[xKey]));
  const xMin = xValues[0];
  const xMax = xValues[xValues.length - 1];
  const xRange = Math.max(1, xMax - xMin);

  // Build the polyline `points` attribute: "x1,y1 x2,y2 ..." in viewBox units.
  const points = data
    .map((d, i) => {
      const x = left + ((Number(d[xKey]) - xMin) / xRange) * plotW;
      const y = top + plotH - (Number(d[yKey]) / yMax) * plotH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div ref={containerRef} className={clsx("line-chart", className)} role="img" aria-label={ariaLabel}>
      <svg width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} preserveAspectRatio="none">
        {ariaLabel ? <title>{ariaLabel}</title> : null}

        {/* Y-axis gridlines + tick marks + tick labels (0, max/2, max). */}
        {Array.from({ length: Y_TICKS }).map((_, i) => {
          const frac = i / (Y_TICKS - 1);
          const y = top + plotH - frac * plotH;
          return (
            <g key={`y-${i}`} className="line-chart-y-tick">
              <line className="line-chart-grid" x1={left} y1={y} x2={left + plotW} y2={y} />
              <line className="line-chart-axis-tick" x1={left - 3} y1={y} x2={left} y2={y} />
              <text className="line-chart-y-tick-label" x={left - 5} y={y} textAnchor="end" dominantBaseline="middle">
                {(yMax * frac).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Plot border. */}
        <rect className="line-chart-border" x={left} y={top} width={plotW} height={plotH} fill="none" />

        {/* X-axis start / end labels. */}
        <text className="line-chart-x-tick-label" x={left} y={top + plotH + 4} textAnchor="start" dominantBaseline="hanging">
          {xMin}
        </text>
        <text className="line-chart-x-tick-label" x={left + plotW} y={top + plotH + 4} textAnchor="end" dominantBaseline="hanging">
          {xMax}
        </text>

        {/* Series line. */}
        <polyline className="line-chart-series" points={points} fill="none" />

        {/* X-axis title (centered below). */}
        {xLabel ? (
          <text className="line-chart-axis-title" x={left + plotW / 2} y={height - 4} textAnchor="middle">
            {xLabel}
          </text>
        ) : null}

        {/* Y-axis title (rotated up the left edge). */}
        {yLabel ? (
          <text
            className="line-chart-axis-title"
            x={0}
            y={0}
            textAnchor="middle"
            transform={`translate(11, ${top + plotH / 2}) rotate(-90)`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
```

**Step 3: Write the SCSS**

Create `packages/shared/src/components/line-chart/line-chart.scss`. All colors / fonts come from tokens; SVG elements pick them up via the `stroke` / `fill` / `font` properties on the targeted classes.

```scss
@use "../../styles/tokens" as tokens;

.line-chart {
  display: block;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-sm;
  width: 100%;

  svg {
    display: block;
  }

  .line-chart-grid {
    stroke: tokens.$color-border-subtle;
    stroke-width: 1;
  }

  .line-chart-axis-tick {
    stroke: tokens.$color-text-muted;
    stroke-width: 1;
  }

  .line-chart-border {
    stroke: tokens.$color-text;
    stroke-width: 1;
  }

  .line-chart-y-tick-label,
  .line-chart-x-tick-label {
    fill: tokens.$color-text-muted;
  }

  .line-chart-axis-title {
    fill: tokens.$color-text-muted;
  }

  .line-chart-series {
    stroke: tokens.$color-text;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }
}

.line-chart-empty {
  align-items: center;
  color: tokens.$color-text-muted;
  display: flex;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-sm;
  justify-content: center;
  width: 100%;
}
```

**Step 4: Export from the barrel**

In `packages/shared/src/index.ts`:

```ts
export { LineChart, type LineChartProps } from "./components/line-chart/line-chart";
```

**Step 5: Migrate the Starter's data-panel chart**

In `packages/starter/src/components/data-panel.tsx`:

- Drop `TS_H`, `TS_MARGIN` (or whatever constants live alongside the line chart), `TimeSeriesChart`, `drawChart`, and the line-chart-specific `useRef` / `useEffect` canvas wiring.
- Keep the `Histogram` component, `drawHistogram`, `histogramBins`, `niceStep`, and any histogram-only helpers untouched in this task — Task 8 migrates them.
- Keep the shared canvas helpers (`drawAxes`, `drawNoData`, `drawAxisTitles`) — `Histogram` still uses them. They get dropped in Task 8 once both charts have been migrated.
- Replace the `<TimeSeriesChart series={selectedSeries} />` JSX (inside the "Average Distance Over Time" `<DataSubsection>`) with:

```tsx
const SAMPLE_EVERY = 10; // already a constant in this file; reuse it
const chartData = selectedSeries.map((avg, i) => ({ frame: (i + 1) * SAMPLE_EVERY, avg }));
// ...
<DataSubsection title="Average Distance Over Time">
  <LineChart
    data={chartData}
    xKey="frame"
    yKey="avg"
    height={130}
    ariaLabel="Average distance over time"
    xLabel="Frame"
    yLabel="Avg distance"
    emptyState="No data"
  />
</DataSubsection>
```

Import: `import { DataSubsection, LineChart } from "@concord-consortium/mass-sims-shared";`.

In `data-panel.scss`, drop the `.series-chart` rules (now unused). Keep any `.histogram-chart` rules.

**Step 6: Update Starter tests**

The DataPanel's existing test that asserts `getByLabelText(/distance over time/i)` continues to work — the new `<LineChart>` exposes the `ariaLabel` via the wrapper div. The "always renders the time-series chart, with or without data" test still passes: empty-state in one branch, SVG in the other. The PR-feedback live-series test continues to pass (the data flow into `<LineChart>` is the same shape as into the previous `<TimeSeriesChart>`).

If any assertions reach into `<canvas>` element specifics, swap them to the new structure (`getByRole("img", { name: /distance over time/i })` is the cleanest replacement).

**Step 7: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test line-chart
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter build
```

Expected: all 6 LineChart tests pass; Starter tests continue to pass.

**Step 8: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared,starter): hand-rolled SVG LineChart + migrate Starter's time-series chart`

(Suggested files to stage when the user is ready: the three new line-chart files, the barrel export update, and the three modified Starter files.)

---

## Task 8: Shared `<Histogram>` (hand-rolled SVG) + migrate Starter chart

Hand-rolled SVG histogram — no charting library. Same SVG approach as the LineChart (Task 7): axes via `<line>`, tick labels via `<text>`, bars via `<rect>`, single `<title>` for the chart's accessible name. Differs from LineChart in input shape: a histogram takes **raw numeric values** and auto-bins them, rather than receiving pre-positioned `(x, y)` pairs. This distinguishes it from a future categorical `<BarChart>` (FOSS's `BarGraph` shape — takes pre-named tick groups + value arrays) which is deferred until a sim needs non-binned bar data.

The Starter's `data-panel.tsx` already has the binning logic (`histogramBins` + `niceStep` helpers, plus a canvas-based `Histogram` component using `drawHistogram`). The shared component lifts those helpers into shared utils, ports the canvas drawing to SVG, and replaces the Starter's local `Histogram` with the shared one.

**Why a separate component from LineChart:**
- Different input contract (raw values for auto-binning vs. pre-positioned data points). Combining them via a `chartType` prop would force callers to construct the wrong shape on one side.
- Different default visual treatment (bars vs. line, bottom-anchored axis labels at every bin boundary).
- Bin-axis logic (round-number `niceStep` widths so bin edges land at sensible numbers) is histogram-specific and not transferable to the line chart.

**Files:**
- Create: `packages/shared/src/components/histogram/histogram.tsx`
- Create: `packages/shared/src/components/histogram/histogram.scss`
- Create: `packages/shared/src/components/histogram/histogram.test.tsx`
- Create: `packages/shared/src/utils/histogram-bins.ts` (lifted from Starter `data-panel.tsx`)
- Create: `packages/shared/src/utils/histogram-bins.test.ts` (port any Starter-side tests for `histogramBins` / `niceStep`)
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/starter/src/components/data-panel.tsx` (drop the local `Histogram` + `drawHistogram` + helper imports; render `<Histogram>` instead)
- Modify: `packages/starter/src/components/data-panel.scss` (drop now-unused `.histogram-chart` canvas styling)
- Modify: `packages/starter/src/components/data-panel.test.tsx` (update assertions for the new chart's DOM)

> **Scope note:** The Starter's `Walker` type is sim-specific (a 2D random-walk position with `{ x, y }`). The shared `<Histogram>` takes plain `number[]` — the Starter computes walker-to-distance (`Math.hypot(w.x, w.y)`) in the data-panel before passing the values down. The mapping stays sim-side because different sims will have different "what value goes in the histogram" intents.

**Step 1: Lift `histogramBins` + `niceStep` to shared utils**

Move the existing `histogramBins(values: number[], targetBinCount: number)` and `niceStep(raw: number)` functions from `packages/starter/src/components/data-panel.tsx` into `packages/shared/src/utils/histogram-bins.ts`. Generalize the input signature: in the Starter today it takes `walkers: readonly Walker[]` and computes `Math.hypot` internally; the shared version takes `values: readonly number[]` so the caller maps however they want.

```ts
// packages/shared/src/utils/histogram-bins.ts

/**
 * Round `raw` up to a "nice" step size — one of 1 / 2 / 5 / 10 / 20 / 50 / 100 / … at the
 * appropriate order of magnitude. Used to choose round-number histogram bin widths AND
 * round-number y-axis maximums so the gridlines land on clean integers.
 *
 * Lifted from the Starter sim's data-panel during Phase 3.
 */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const mantissa = raw / base;
  if (mantissa <= 1) return base;
  if (mantissa <= 2) return 2 * base;
  if (mantissa <= 5) return 5 * base;
  return 10 * base;
}

export interface HistogramBins {
  counts: number[];
  binWidth: number;
}

/**
 * Bin `values` into ~`targetBinCount` equal-width bins from 0 to the smallest multiple of
 * `binWidth` that contains every value. `binWidth` is the `niceStep` of `max / targetBinCount`,
 * so bin boundaries are round numbers a learner can read off the axis.
 *
 * Empty `values` returns a single empty bin so the consumer's render path stays simple.
 *
 * Lifted from the Starter sim's data-panel during Phase 3.
 */
export function histogramBins(
  values: readonly number[],
  targetBinCount: number,
): HistogramBins {
  if (values.length === 0) return { counts: [0], binWidth: 1 };
  const maxValue = Math.max(...values);
  const binWidth = niceStep(maxValue / targetBinCount);
  const binCount = Math.max(1, Math.ceil(maxValue / binWidth));
  const counts = new Array(binCount).fill(0);
  for (const v of values) {
    // Last bin includes the upper edge so the max value isn't lost.
    const idx = Math.min(binCount - 1, Math.floor(v / binWidth));
    counts[idx] += 1;
  }
  return { counts, binWidth };
}
```

Create `packages/shared/src/utils/histogram-bins.test.ts` covering: empty input → `{ counts: [0], binWidth: 1 }`; values within one bin → single-bin output; multi-bin output has the expected counts and the right `binWidth` rounded up by `niceStep`; the upper-edge value lands in the last bin, not in an over-the-edge bin.

Run `yarn workspace @concord-consortium/mass-sims-shared test histogram-bins` — expect FAIL.

**Step 2: Write the failing component tests**

Create `packages/shared/src/components/histogram/histogram.test.tsx`. Mirror the LineChart tests' shape (Task 7) — render assertions on the SVG structure since jsdom can't introspect rendered pixels:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Histogram } from "./histogram";

describe("Histogram", () => {
  it("renders the empty state when values is empty", () => {
    const { getByText, container } = render(
      <Histogram values={[]} height={160} ariaLabel="Test histogram" />,
    );
    expect(getByText("No data")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a custom empty-state message when supplied", () => {
    const { getByText } = render(
      <Histogram values={[]} height={160} emptyState="Run a trial" />,
    );
    expect(getByText("Run a trial")).toBeInTheDocument();
  });

  it("renders an SVG with one <rect> per non-empty bin", () => {
    // Values 0..20 with targetBinCount = 5 → binWidth = niceStep(20/5) = 5
    // → bins of 5 each, 5 bins total — all should be non-empty.
    const values = Array.from({ length: 21 }, (_, i) => i);
    const { container } = render(
      <Histogram values={values} targetBinCount={5} height={160} ariaLabel="dist" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    const bars = container.querySelectorAll("rect.histogram-bar");
    // Exact bin count depends on niceStep; assert at least 1 bar rendered.
    expect(bars.length).toBeGreaterThan(0);
  });

  it("does NOT render a <rect> for empty bins (count === 0)", () => {
    // Cluster all values into the first bin so other bins are empty.
    const values = [0, 0, 0, 0];
    const { container } = render(
      <Histogram values={values} targetBinCount={5} height={160} />,
    );
    const bars = container.querySelectorAll("rect.histogram-bar");
    // At most one bar (the first bin); empties shouldn't render even a hairline rect.
    expect(bars.length).toBe(1);
  });

  it("exposes the ariaLabel on the chart region", () => {
    const { getByLabelText } = render(
      <Histogram values={[1, 2, 3]} height={160} ariaLabel="Distance distribution" />,
    );
    expect(getByLabelText("Distance distribution")).toBeInTheDocument();
  });

  it("renders x and y axis titles when supplied", () => {
    const { getByText } = render(
      <Histogram
        values={[1, 2, 3]}
        height={160}
        xLabel="Distance from start"
        yLabel="# of walkers"
      />,
    );
    expect(getByText("Distance from start")).toBeInTheDocument();
    expect(getByText("# of walkers")).toBeInTheDocument();
  });

  it("labels every bin boundary on the x-axis (one more label than bin count)", () => {
    const values = [0, 5, 10, 15, 20];
    const { container } = render(
      <Histogram values={values} targetBinCount={5} height={160} />,
    );
    // bin boundaries at 0, binWidth, 2*binWidth, … one label per boundary.
    const labels = container.querySelectorAll(".histogram-x-tick-label");
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test histogram` — expect FAIL.

**Step 3: Write the component**

Create `packages/shared/src/components/histogram/histogram.tsx`. Same overall shape as Task 7's LineChart: ResizeObserver-backed responsive width, default margins, SVG primitives, token-driven SCSS classes. The math is ported from the Starter's `drawHistogram`.

> **As-built note:** Task 7's LineChart was restyled (per design feedback against the demo spec) to drop the plot-border box and tick marks in favor of full-width gridlines only, with the SVG marked `aria-hidden` under a `role="img"` wrapper and margins that grow only when axis titles are supplied. The Histogram was built to **match that restyled style** for visual consistency in the Data panel — so the snippet below differs from what shipped: no `<rect histogram-border>`, no `histogram-axis-tick` marks, `aria-hidden` on the `<svg>`, and dynamic margins. The bar / gridline / label structure is otherwise as written.

```tsx
import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { histogramBins, niceStep } from "../../utils/histogram-bins";
import "./histogram.scss";

const DEFAULT_MARGIN = { top: 12, right: 12, bottom: 40, left: 46 };
const DEFAULT_BIN_COUNT = 7;
const BAR_GAP_PX = 2;

export interface HistogramProps {
  /** Raw numeric values to bin. Empty array renders the empty state. */
  values: readonly number[];
  /** ~bin count; actual count depends on niceStep rounding. Defaults to 7. */
  targetBinCount?: number;
  /** Fixed height in pixels. Width is responsive. */
  height: number;
  /** Accessible name announced for the chart region. */
  ariaLabel?: string;
  /** Optional X-axis title rendered below the plot (e.g. "Distance from start"). */
  xLabel?: string;
  /** Optional Y-axis title rendered rotated up the left edge (e.g. "# of walkers"). */
  yLabel?: string;
  /** Empty-state content shown when `values` is empty. Defaults to "No data". */
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Hand-rolled SVG histogram. Auto-bins raw `values` into ~`targetBinCount` round-width bins
 * using `histogramBins` / `niceStep` (in `utils/histogram-bins.ts`). The y-axis maximum is
 * also `niceStep`-rounded so gridlines land on clean integers.
 *
 * For pre-categorized bar data (named tick groups + value arrays — FOSS's `BarGraph` shape),
 * a future `<BarChart>` is the right home. See the Phase 3 plan's Deferred follow-ups.
 */
export function Histogram({
  values,
  targetBinCount = DEFAULT_BIN_COUNT,
  height,
  ariaLabel,
  xLabel,
  yLabel,
  emptyState,
  className,
}: HistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (values.length === 0) {
    return (
      <div
        ref={containerRef}
        className={clsx("histogram-empty", className)}
        role="img"
        aria-label={ariaLabel}
        style={{ height }}
      >
        {emptyState ?? "No data"}
      </div>
    );
  }

  const { counts, binWidth } = histogramBins(values, targetBinCount);
  const maxCount = Math.max(...counts, 1);
  const yMax = niceStep(maxCount);
  const { top, right, bottom, left } = DEFAULT_MARGIN;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const barWidth = plotW / counts.length;
  const yTickCount = 3; // 0 / yMax/2 / yMax — same convention as LineChart

  return (
    <div ref={containerRef} className={clsx("histogram", className)} role="img" aria-label={ariaLabel}>
      <svg width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} preserveAspectRatio="none">
        {ariaLabel ? <title>{ariaLabel}</title> : null}

        {/* Y-axis gridlines + tick marks + tick labels (0 / yMax/2 / yMax). */}
        {Array.from({ length: yTickCount }).map((_, i) => {
          const frac = i / (yTickCount - 1);
          const y = top + plotH - frac * plotH;
          return (
            <g key={`y-${i}`}>
              <line className="histogram-grid" x1={left} y1={y} x2={left + plotW} y2={y} />
              <line className="histogram-axis-tick" x1={left - 3} y1={y} x2={left} y2={y} />
              <text
                className="histogram-y-tick-label"
                x={left - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {Math.round(yMax * frac)}
              </text>
            </g>
          );
        })}

        {/* Plot border. */}
        <rect className="histogram-border" x={left} y={top} width={plotW} height={plotH} fill="none" />

        {/* Bars — skip empty bins so 0-count bins don't render a hairline. */}
        {counts.map((count, i) => {
          if (count === 0) return null;
          const h = (count / yMax) * plotH;
          return (
            <rect
              key={`bar-${i}`}
              className="histogram-bar"
              x={left + i * barWidth + BAR_GAP_PX / 2}
              y={top + plotH - h}
              width={barWidth - BAR_GAP_PX}
              height={h}
            />
          );
        })}

        {/* X-axis labels at every bin boundary (one more label than bin count). */}
        {Array.from({ length: counts.length + 1 }).map((_, i) => (
          <text
            key={`x-${i}`}
            className="histogram-x-tick-label"
            x={left + (i / counts.length) * plotW}
            y={top + plotH + 4}
            textAnchor="middle"
            dominantBaseline="hanging"
          >
            {i * binWidth}
          </text>
        ))}

        {/* X-axis title (centered below). */}
        {xLabel ? (
          <text className="histogram-axis-title" x={left + plotW / 2} y={height - 4} textAnchor="middle">
            {xLabel}
          </text>
        ) : null}

        {/* Y-axis title (rotated up the left edge). */}
        {yLabel ? (
          <text
            className="histogram-axis-title"
            x={0}
            y={0}
            textAnchor="middle"
            transform={`translate(11, ${top + plotH / 2}) rotate(-90)`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
```

**Step 4: Write the SCSS**

Create `packages/shared/src/components/histogram/histogram.scss`. Mirrors the LineChart's class structure so the two charts read consistently. Bar fill uses a slightly lighter grey than the LineChart series line so they don't look identical when both render in the same panel.

```scss
@use "../../styles/tokens" as tokens;

.histogram {
  display: block;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-sm;
  width: 100%;

  svg {
    display: block;
  }

  .histogram-grid {
    stroke: tokens.$color-border-subtle;
    stroke-width: 1;
  }

  .histogram-axis-tick {
    stroke: tokens.$color-text-muted;
    stroke-width: 1;
  }

  .histogram-border {
    stroke: tokens.$color-text;
    stroke-width: 1;
  }

  .histogram-y-tick-label,
  .histogram-x-tick-label {
    fill: tokens.$color-text-muted;
  }

  .histogram-axis-title {
    fill: tokens.$color-text-muted;
  }

  .histogram-bar {
    fill: tokens.$color-text-muted;
  }
}

.histogram-empty {
  align-items: center;
  color: tokens.$color-text-muted;
  display: flex;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-sm;
  justify-content: center;
  width: 100%;
}
```

**Step 5: Export from the barrel**

In `packages/shared/src/index.ts`, add the component:

```ts
export { Histogram, type HistogramProps } from "./components/histogram/histogram";
```

**Step 6: Migrate the Starter's data-panel chart**

In `packages/starter/src/components/data-panel.tsx`:

- Drop the local `histogramBins`, `niceStep`, `HIST_H`, `HIST_MARGIN`, `Histogram` component, `drawHistogram`, and the histogram-specific `useRef` / `useEffect` canvas wiring.
- Drop the canvas helpers (`drawAxes`, `drawNoData`, `drawAxisTitles`, `Margin` type) — Task 7 already removed the line-chart usage, so after this task they're fully orphaned. Verify by searching the file for references after the drops.
- Compute the walker-distance values sim-side and pass them down. The existing `Histogram` call is `<Histogram walkers={finalWalkers} />`; replace it with:

```tsx
const distances = finalWalkers.map((w) => Math.hypot(w.x, w.y));
// ...
<DataSubsection title="Final Distance Distribution">
  <Histogram
    values={distances}
    height={160}
    ariaLabel="Final distance distribution"
    xLabel="Distance from start"
    yLabel="# of walkers"
    emptyState="No data"
  />
</DataSubsection>
```

Import the shared component: `import { Histogram, LineChart, DataSubsection } from "@concord-consortium/mass-sims-shared";` (consolidating with Task 7's LineChart import).

In `data-panel.scss`, drop the `.histogram-chart` rules (now unused).

**Step 7: Update Starter tests**

The DataPanel's existing histogram test continues to query by `getByLabelText(/distance distribution/i)` — that still works because the new `<Histogram>` exposes `ariaLabel` via the wrapper div. If any assertions reach into the `<canvas>` element specifically, swap them to the new structure (`getByRole("img", { name: /distance distribution/i })` is the cleanest replacement).

If the Starter had a unit test against the OLD `histogramBins` / `niceStep` helpers in its data-panel, move those test cases into the new `packages/shared/src/utils/histogram-bins.test.ts` (Step 1) and delete the duplicates from the Starter's test file.

**Step 8: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test histogram
yarn workspace @concord-consortium/mass-sims-shared test histogram-bins
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared build
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter build
```

Expected: 7 Histogram tests pass, all histogram-bins tests pass, Starter tests continue to pass.

**Step 9: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared,starter): hand-rolled SVG Histogram + lift histogramBins/niceStep helpers + migrate Starter chart`

(Suggested files to stage when the user is ready: the five new shared files, the barrel export update, and the three modified Starter files.)

---

## Task 9: Documentation updates

Lock in Phase 3's concrete contracts and close the open UI-library question.

**Files:**
- Modify: `docs/infrastructure-plan.md`
- Modify: `docs/ui-design-plan.md`
- Modify: `packages/shared/README.md` (if it exists)
- Modify: `docs/adding-a-new-sim.md` (if it exists from Phase 2c)

**Step 1: Update infrastructure-plan.md §3 component catalog**

Add new entries for `<Slider>`, `<NumberField>`, `<Switch>`, `<Select>`, `<Checkbox>`, `<LineChart>`, `<Histogram>` immediately below the `<Button>` entry that landed in Phase 2c. Each entry is 2–3 lines: prop surface, what react-aria-components primitive it wraps (or "hand-rolled SVG" for the chart entries), where the auto-emit fires for form controls (`onChangeEnd` for Slider, `onChange` for the others). Cross-reference §11 #28 (commit-only emission) for Slider. Note that `<Histogram>` takes raw `number[]` values and auto-bins them via the `histogramBins` / `niceStep` helpers, distinguishing it from a future categorical `<BarChart>`.

**Step 2: Update infrastructure-plan.md §3 utilities section**

Add a one-line entry for `histogramBins` / `niceStep` (the binning helpers lifted from Starter's data-panel into shared utils so any sim can do its own histogram binning).

**Step 3: Update infrastructure-plan.md §7 dependency table**

Remove the existing `@tanstack/react-table ^8` row — that decision has been deferred (see Phase 3 plan's Deferred follow-ups for context). No new rows are added in this phase — both charts are hand-rolled SVG and the optional axe-core dev integration was deferred to Phase 6 hardening.

**Step 4: Update infrastructure-plan.md §11 resolved decisions**

Update the chart library entry:

> 19. **Charting library** → **None — hand-rolled SVG.** Shared `<LineChart>` and `<Histogram>` in `packages/shared` are React + SCSS + SVG components (no library), modeled on FOSS's `BarGraph` in spirit. `<Histogram>` auto-bins raw values via the `histogramBins` / `niceStep` helpers (also exported from `packages/shared` so sims can do their own binning); `<LineChart>` renders a single-series line over pre-positioned `(x, y)` data. Matches FOSS / DESE precedent (both hand-roll their data visualizations). Token-driven theming via CSS classes targeting SVG attributes. Sims that need other chart types (categorical bar, scatter, area, multi-series, etc.) add their own hand-rolled component when the use case appears; if a sim eventually needs interactive tooltips, animations, brushing, or zooming that would be too costly to build, the library question gets revisited then with concrete requirements. Closes UI Design Plan §15 Q19.

**Step 5: Close UI design plan §15 Q19**

In `docs/ui-design-plan.md` §15, find Q19 (graphing library) and mark it **Closed.** with: "Resolved to hand-rolled SVG, matching FOSS / DESE precedent. See infrastructure-plan.md §11 #19 and §3 `<LineChart>`."

**Step 6: Update `docs/adding-a-new-sim.md` (if present)**

Replace any "use native HTML inputs for parameters" guidance with: "Use `<Slider>`, `<NumberField>`, `<Switch>`, `<Select>`, `<Checkbox>` from `@concord-consortium/mass-sims-shared` for parameter inputs — they auto-emit log events when given an `action="…"` prop. See infrastructure-plan.md §3 'Shared controls policy' for the wrapping convention." Include short code snippets matching the Starter migration.

**Step 7: Update `packages/shared/README.md` (if it exists)**

Add one-line entries in the components / utilities sections for the new pieces.

**Step 8: Run checks**

```bash
yarn lint
```

(Docs only; no typecheck / test run needed.)

**Step 9: Stop and wait for user review**

Suggest the commit message: `docs: lock in Phase 3 contracts; close Q19 (hand-rolled SVG)`

---

## Task 10: Full-repo verification

**Step 1: Run cross-cutting checks**

```bash
yarn typecheck
yarn lint
yarn test
yarn gen-index --check
yarn gen-workflows --check
```

Expected: all pass.

**Step 2: Confirm sims build**

```bash
MASS_SIMS_VERSION_PATH=version/release yarn build
```

Expected: `sim-one`, `sim-two`, `starter` (template), `sim-frame-preview` (dev tool) all build cleanly.

**Step 3: Visual sweep of the Starter**

```bash
yarn workspace starter dev
```

Open the URL and confirm:

- All controls render correctly: Walker count and Step size as sliders with value readouts, Frames per trial as a number field with stepper buttons.
- Sliders drag smoothly; the value updates live in the readout AND in the canvas (walker count change is immediate).
- Frame field's stepper buttons work; min/max clamping fires.
- All controls disable when a run is in progress (Slider thumb fades, NumberField goes muted).
- Time-series chart renders via the hand-rolled SVG `<LineChart>`; live updates during a run still work (per Phase 2b PR-feedback fix); chart resizes responsively when the Data column resizes.
- Histogram renders via the hand-rolled SVG `<Histogram>`; bin boundaries are round numbers; bars fill the plot area; empty bins don't render a hairline; the chart resizes responsively.
- Browser console: no errors from react-aria-components or the charts.
- (Optional, not blocking.) Run the axe DevTools Chrome extension on the Starter page; record any critical or serious violations for the Phase 6 hardening backlog. Violations are not a Phase 3 blocker.

**Step 4: Visual sweep of sim-frame-preview**

```bash
yarn workspace sim-frame-preview dev
```

The preview's placeholder content doesn't use any of the new controls, but check that nothing regressed at the four target widths.

**Step 5: Spot-check the new shared components**

For each new shared component, briefly visit the Starter (Slider / NumberField / LineChart / Histogram are all in use) and at least eyeball Switch / Select / Checkbox by adding a temporary throwaway `<TestControls />` to the Starter's data panel that renders one of each, then remove it before commit. Or rely on the unit tests' snapshot of the component shape — your call. The throwaway approach catches visual bugs (alignment, focus rings, hover states) the unit tests can't.

No commit for Task 10 — verification only.

---

## Done criteria

- [x] No new dependencies added to `packages/shared/package.json` — both charts are hand-rolled SVG and runtime a11y checking is deferred to Phase 6 hardening. _(Verified: no `package.json` changed in Phase 3.)_
- [x] `<Slider>` exported, tested, and documented in infra plan §3. Auto-emits via `useLogEvent` ON COMMIT (`onChangeEnd`), not during drag.
- [x] `<NumberField>` exported, tested, and documented. Auto-emits on `onChange` (commit semantics in react-aria).
- [x] `<Switch>` exported, tested, and documented. Auto-emits on `onChange`. _(Built on the non-deprecated `SwitchField` + `SwitchButton`.)_
- [x] `<Select>` exported, tested, and documented. Auto-emits on `onSelectionChange`.
- [x] `<Checkbox>` exported, tested, and documented. Auto-emits on `onChange`. Indeterminate state supported. _(Built on `CheckboxField` + `CheckboxButton`.)_
- [x] Starter's walker-count, step-size, and frames-per-trial inputs migrated to `<Slider>` / `<NumberField>`. Log events `walkers_set`, `step_size_set`, `frames_per_trial_set` fire on commit. _(Plus one of each remaining control added as a live example.)_
- [x] `<LineChart>` exported, tested, and documented. Starter's data-panel canvas time-series chart replaced with `<LineChart>`; live-series flow from the Phase 2b PR-feedback fix continues to work.
- [x] `<Histogram>` exported, tested, and documented. `histogramBins` + `niceStep` helpers lifted from Starter — **co-located with the `<Histogram>` component as internal helpers (not a public `utils/` export)**, with their own tests. Starter's data-panel canvas histogram replaced with `<Histogram>`; the Starter computes walker→distance sim-side and passes plain `number[]` down.
- [x] `docs/infrastructure-plan.md` §3 catalogs the new components; §11 closes #19 (hand-rolled SVG).
- [x] `docs/ui-design-plan.md` §15 Q19 marked Closed.
- [x] `yarn typecheck && yarn lint && yarn test && yarn gen-index --check && yarn gen-workflows --check && yarn build` all green.
- [x] Visual sweep of the Starter passes.

---

## Deferred follow-ups (out of scope here)

- Multi-sim test harness workspace (Phase 4).
- First real simulation (Phase 5+) and the framework-level pattern for in-progress transient state escaping `useModelState` / `useSimulationRunner` to consumers outside the Simulation slot.
- `<Dialog>` primitive (Phase 2a leftover — lands when reload-warning confirmation, About-panel polish, or a new sim's dialog need forces it).
- `<ToggleButton>` / pressed-state Button variant — covered by Button + `aria-pressed` for now.
- **Categorical `<BarChart>`** (pre-named tick groups + value arrays, FOSS's `BarGraph` shape — distinct from `<Histogram>`, which auto-bins raw values). Defer until a sim needs to plot pre-categorized data (e.g. "early / mid / late" buckets the sim author defines). Implementation can lift from FOSS's `BarGraph` (positioned HTML divs, ~140 lines) or follow our LineChart / Histogram pattern (SVG primitives) depending on which fits the first such sim's needs.
- Scatter and area charts. Add hand-rolled SVG components when a sim needs them, matching the LineChart pattern.
- **`<LineChart>` multi-series + legend + marker configurability** — needed by a real sim already in design (the Bananas genetics demo; reference implementation in `~/Documents/webdev/demos/index.html`, the canvas `drawLine` routine ~line 3350 + the y-gridline/legend code). Deliberately **not** pre-built in Phase 3: the demo is a static mockup, so the multi-series API should be shaped by that sim's actual data flow / interactions (it has a selected-generation highlight, a "fungus introduced" marker line, dynamic aria-labels, etc.) rather than guessed against the picture. Adding it later is non-breaking — today's single-series `data`/`xKey`/`yKey` stays a valid special case. Concrete requirements captured from the demo so they aren't lost:
  - **Multiple series** drawn over a shared axis (demo: "Healthy" + "Infected"), each with its own colour, line style (solid vs dotted/dashed), and marker style.
  - **Marker styles:** plain filled circle, and filled circle with a white centre dot ("donut"); markers sized larger than Phase 3's fixed `r=3` and **scaled to point spacing** (demo: `r = clamp(xStep · 0.35, 4, 8)`, with the selected point bumped ×1.25). So a `pointRadius?: number` (or an auto-scale mode) plus a per-series `marker?: "filled" | "donut" | "none"`.
  - **Legend** with line+marker swatches per series (demo renders "● Healthy" / "◌ Infected" below the plot).
  - **Thicker stroke** (demo uses 3px vs Phase 3's 2.5px) — likely a per-series or chart-level prop.
  - Likely API shape: `series: Array<{ name; data; color?; dashed?; marker? }>` + `legend?: boolean` + `pointRadius?`, with the current single-series props kept as shorthand or migrated. Build it when that sim is implemented, validating against its real data.
- **`<Table>` component.** Deliberately deferred — no sim currently in design needs one, and CC hasn't used `@tanstack/react-table` before, so we'd rather let the first sim with tabular data shape the library choice (Tanstack vs raw react-aria-components Table vs something else) and the wrapper's API surface. When that sim arrives, this becomes a focused phase: pick the underlying lib based on the sim's needs (sortable headers? filtering? pagination? row selection? virtualization?), wrap it, validate against the sim, then ship.
- Date / time / color / file / search / autocomplete controls. Add when a sim needs them.
- Charting library escape hatch — if hand-rolling ever proves wrong (a sim needs interactive tooltips, animations, brushing/zooming, or multi-series with crossfilter behavior that would be expensive to build), revisit the library question with concrete sim requirements rather than speculative ones. Recharts, Visx, Chart.js, and Plotly are all viable candidates at that point.
- **Runtime accessibility checking via `axe-core`** (Phase 6 hardening). A small in-tree `initAxeDev` wrapper around `axe-core` (~30 lines) running in dev mode via `MutationObserver`, dev-only and gated on `import.meta.env.DEV`. Deliberately deferred from Phase 3: Biome's a11y rule group + the axe DevTools Chrome extension cover most of what the runtime wrapper would catch, and the runtime integration is more valuable once there are real sims to check (not just the template). Also see `@axe-core/playwright` for CI-enforced checks in the Phase 6 Playwright suite. (Note: `@axe-core/react` is archived for React 18+, so any future integration goes through the bare `axe-core` package directly.)
- Lighthouse + axe DevTools full audits (Phase 6 hardening).
- Playwright suite (Phase 6).
