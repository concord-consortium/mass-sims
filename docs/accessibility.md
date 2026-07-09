# Accessibility conventions

The practical, cross-cutting accessibility rules every Mass Sims sim follows. They were settled
during the MAS-24 (keyboard/focus) and MAS-25 (ARIA) audits of Bananas, benchmarked against the
[demo](https://models-resources.concord.org/demos/branch/masssims/), and are baked into the shared
library so new sims inherit them.

This is the **conventions reference** — what to do and why, so decisions aren't re-litigated per sim.
Related material: the shared-component API is in [packages/shared/README.md](../packages/shared/README.md);
the audit decision log and known-gap rationale in
[infrastructure-plan.md §3 "Accessibility conventions & known gaps"](./infrastructure-plan.md); the
About-panel interaction spec in [ui-design-plan.md §14 (#21)](./ui-design-plan.md); and how these are
exercised end-to-end in [playwright.md](./playwright.md).

No color-blind theme system, no light/dark mode, no read-aloud/TTS — standard semantic HTML + ARIA +
a well-tested palette is the whole strategy.

---

## Baseline rules

- **Semantic HTML first.** Prefer native `<button>`, `<ul>`/`<li>`, real headings over `role` divs.
  Bananas' cross list is a native `<ul>`/`<li>` with `<button aria-pressed>` rows, not `role` divs.
- **Decorative SVGs are always `aria-hidden="true"`** — baked into each icon component (including the shared `InfoIcon`/`CloseIcon`). Brand logos use a real `alt`.
- **Color is never the only channel.** The palette is chosen with deuteranopia/protanopia in mind;
  encode state with shape + label + color redundantly, meeting WCAG AA contrast.
- **Touch targets ≥ 44 × 44 px** everywhere (the `--touch-target-min` token). Pointer events, no
  hover-only affordances.
- **Landmark structure.** `<SimulationFrame>` gives screen-reader users a clean landmark set: the
  title bar is a banner (`<header>`), the three slots live in a `<main>` (the "skip to main content"
  target), and the About panel is a `complementary` aside.

---

## Disabled-control policy (intentionally split — do not "unify")

There are two disabling mechanisms, chosen per control on purpose. This split mirrors the demo; it is
deliberate, not an inconsistency to fix.

| Mechanism | Controls | Why |
| --- | --- | --- |
| **`aria-disabled` + a JS activation guard** (stays focusable, keeps its tab stop) | shared `<Button>`, `<TrialResetButton>`, Bananas' fungus switch | Keyboard/AT users can still discover the control while it's inert. |
| **react-aria's native `disabled`** (dropped from the tab order) | the form inputs `<Select>`, `<Slider>`, `<Switch>`, `<Checkbox>`, `<NumberField>` | Standard form-field behavior; nothing to discover while disabled. |

(The parent `<Select>`'s native-disabled path is effectively unreachable anyway — locking swaps it for
a static `.parent-chip`.)

---

## Trials column — single-select listbox

The Trials column is a **`role="listbox"`** (`aria-orientation="vertical"`, `aria-label="Trials"`) of
**`role="option"`** cards (shared `<TrialCard>`):

- Each card carries `aria-selected`, **roving tabindex** (only the selected card is tabbable, the rest
  `-1`), and an **enriched accessible name** (e.g. Starter's `"Trial A. Walker count 50, step size 1"`).
- The **`+ New` card**, the **max-trials notice**, and the **panel-level reset button**
  (`<TrialResetButton>`) are siblings *outside* the listbox — **a listbox must not own focusable
  non-options**. The reset is positioned over the selected card via a CSS `--selected-index`.
- **Keyboard contract:** Up/Down move focus **and** selection to the adjacent card and **wrap**
  (last→first, first→last); Home/End jump to first/last; Left/Right are ignored (vertical orientation).
  `+ New` sits outside the listbox and handles Enter/Space natively.

Sims reuse Starter's `<TrialsPanel>` and swap in their per-card body + enriched `aria-label`.

> **History:** this was a `tablist`/`tab` pattern (no `tabpanel`s, non-tab children inside the list).
> MAS-25 F-1 moved it to `listbox`/`option`; don't reintroduce `role="tab"` for the trials.

---

## Announcements — one polite region per sim

All narration flows through a **single** shared `<Announcer>` (a visually-hidden `aria-live="polite"`
region); descendants call `useAnnounce()` and `announce(message)`.

- **No scattered live regions.** Ambient notices — the status pill, max-crosses, max-trials — are
  **plain visible text with no `role="status"`/`aria-live`**. Bananas has **zero** `role="status"`
  regions and exactly **one** `aria-live` region (the Announcer).
- The Announcer is queue-backed with **at most one pending timer**, and uses clear-then-re-announce so
  repeated identical messages are still spoken. It drops its queue/timer cleanly on unmount.
- Route new narration (selection changes, resets, caps) through the same channel rather than adding a
  region.

---

## Focus management

- **About panel:** focus moves to the **Close** button on open and returns to the **About** trigger on
  close; **Escape** closes. A `wasOpenRef` guard ensures the close-state focus restore never fires on
  mount (so a frame doesn't steal focus to its About button on page load).
- **Non-modal by design.** The About panel is a draggable `role="complementary"` landmark (an
  `<aside>` labelled by its `<h2>` via `aria-labelledby`), **not** `aria-modal`, and focus is
  deliberately **not** trapped — it coexists with the sim. Its trigger keeps `aria-expanded` but has
  **no `aria-haspopup`** (a landmark isn't a popup). Full focus-trapping is the job of the future
  shared centered `<Dialog>` (reload-warning, etc.), a separate component.
- Controls disabled via `aria-disabled` keep their tab stop (see the split above).

---

## Keyboard-operable scroll regions

Scrollable regions (the Trials list, the About panel body, a sim's own scrollers like Bananas'
offspring grid) become keyboard-operable **only while they actually overflow**:

- `useScrollFocusRing` adds `tabindex="0"` when `scrollHeight > clientHeight` and removes it otherwise;
  a sibling `.scroll-focus-ring` draws an inset ring on `:focus-visible`.
- `<Section>` opts in via its `scrollFocusRing` prop (already set on the Trials column, so every sim
  inherits it).
- To assert a `:focus-visible` ring in a real browser, establish keyboard modality with a
  `focus()` → `Shift+Tab` → `Tab` round-trip — a programmatic `.focus()` alone doesn't set
  focus-visible.

---

## Custom toggles — activate on Space *and* Enter

react-aria's `Switch` handles **Space** (native checkbox) but not **Enter**. A custom toggle (Bananas'
fungus switch) adds an **Enter-only** `onKeyDown`; Space stays with react-aria to avoid a double
toggle. Auto-repeat is ignored so a held key doesn't oscillate the state. The exactly-once property is
testable without observing outlines: one keypress must flip the `role="switch"` checked state.

---

## Charts

- A chart **given an `ariaLabel`** is a **`role="img"`** region named by it (internals `aria-hidden`);
  the label is dynamic and reflects the current data. `role` and the name always travel together —
  with no `ariaLabel` the wrapper carries **no role** (decorative) rather than an unlabeled
  `role="img"` (a `role="img"` with no name fails WCAG 1.1.1, and a role-less `<div>` must not carry
  `aria-label`).
- The **empty / no-data state is plain text, not `role="img"`** — `role="img"` is atomic (screen
  readers announce the label and skip descendant text), so it would swallow the visible "No data"
  message. Left unroled, the message is announced and the chart's identity comes from the surrounding
  `<DataSubsection>` heading.
- The resistance **bar chart** additionally renders a **visually-hidden `<table>`** fallback
  (Cross / Healthy / Infected), named `"Fungus resistance data by cross"`, so the underlying numbers
  are available to screen-reader users.

---

## Naming & label-in-name

- **Visible text is the accessible name** wherever possible (the `<Button>` label, the "About"
  trigger). Don't add an `aria-label` that overrides visible text — it trips WCAG 2.5.3 (Label in Name).
- Where an enriched `aria-label` is needed, **fold the visible id into it** so voice-control users can
  speak what they see — e.g. a cross row reads `"Cross B1, 12 offspring, 9 healthy, 3 infected"`, with
  the visible `B1` inside the name.

---

## Select — react-aria APG pattern (by design)

The shared `<Select>` delegates to react-aria's `Select`: a `<button aria-haspopup="listbox">` trigger
plus a `role="listbox"`/`role="option"` popover with **roving DOM focus** (no `aria-activedescendant`).
This is the WAI-ARIA "collapsible listbox" pattern — chosen over the demo's hand-rolled
`role="combobox"` + `aria-activedescendant` ("select-only combobox"). Both are valid APG patterns; the
react-aria one is battle-tested and keyboard-/SR-complete. Documented at the top of
[`select.tsx`](../packages/shared/src/components/select/select.tsx). Don't re-hand-roll a combobox.

---

## Known gaps (deferred — revisit when a consumer needs them)

Recorded so they aren't rediscovered as bugs (MAS-25 F-8):

- **Nameless-if-unnamed controls.** `<NumberField>`, `<Select>`, and `<Slider>` make `label`/`ariaLabel`
  optional with **no `aria-label` fallback** — omitting it yields an unnamed control. `<LineChart>` /
  `<Histogram>` degrade more gracefully: with no `ariaLabel` they drop `role="img"` and render as
  decorative rather than an unlabeled image, so a nameless chart is silent to AT but is not a WCAG
  1.1.1 failure. Every current consumer supplies a name; consider requiring one (or falling back) if a
  future consumer doesn't.
- **No error/validation association yet.** There's no validation UI anywhere, so
  `aria-describedby` / `role="alert"` / `aria-invalid` wiring is N/A today. `<NumberField>` clamps
  `min`/`max` silently. Wire this up if/when a sim adds validation.

---

## How this is tested

The Playwright suite asserts the visible/ARIA behavior (not log payloads) across the four widths — the
trial-selector listbox + roving-tabindex nav, the scroll-focus-ring overflow precondition, the
Space-and-Enter toggle, the reload-warning arming. See [playwright.md](./playwright.md) for the
page-object surface a new sim inherits. Per-workspace Vitest covers roles/names at the unit level.
Manual passes use axe DevTools + VoiceOver.
