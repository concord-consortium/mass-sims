# @concord-consortium/mass-sims-shared

Shared components, hooks, trial-list infrastructure, styles, and build helpers for Mass Sims. The
package is consumed **as source** — its `exports` point at `src/` — so each sim's Vite build and
Vitest run transforms this package's TypeScript directly (there is no build step).

This README is the API reference. For the *design rationale* behind these APIs see
[infrastructure-plan.md §3](../../docs/infrastructure-plan.md); for the accessibility conventions the
components implement see [accessibility.md](../../docs/accessibility.md); for a worked example of
wiring a sim together see [adding-a-new-sim.md](../../docs/adding-a-new-sim.md).

## Importing

Everything public comes from the package barrel:

```ts
import { SimulationFrame, Button, useModelState, seededRandom } from "@concord-consortium/mass-sims-shared";
```

A few non-barrel subpath exports exist for build/style wiring:

| Subpath | What it is |
| --- | --- |
| `@concord-consortium/mass-sims-shared/vite-config` | `createSimViteConfig`, `svgrPlugin`, `gtagInjector` |
| `@concord-consortium/mass-sims-shared/vitest-config` | `createSimVitestConfig` |
| `@concord-consortium/mass-sims-shared/styles/global.scss` | the runtime `:root` custom-property stylesheet — import once per sim entry |
| `@concord-consortium/mass-sims-shared/styles/tokens.scss` | design tokens, for `@use` inside a component's SCSS |
| `@concord-consortium/mass-sims-shared/styles/mixins.scss` | shared SCSS mixins, for `@use` |

> **Shared controls policy.** Every interactive control below is a thin wrapper around a
> `react-aria-components` primitive that (1) applies our tokens/SCSS, (2) auto-emits a log event via
> `useLogEvent` when given an `action`, and (3) forwards all other react-aria props unchanged. Sims
> import controls only from this barrel; needing a primitive we haven't wrapped is the signal to add a
> wrapper, not to pull `react-aria-components` into the sim. See
> [infrastructure-plan.md §3](../../docs/infrastructure-plan.md).

---

## Components

### Layout & chrome

**`<SimulationFrame>`** — the three-region shell every sim renders into. Compound component with
three named slots placed by grid-area (source order doesn't matter).

| Prop | Type | Notes |
| --- | --- | --- |
| `simTitle` | `string` | Shown in the 50 px title bar. |
| `tagline` | `string` | Shown beside the title. |
| `infoModalContent?` | `ReactNode` | Content of the **About** panel; omit to hide the About button. |
| `standalone?` | `boolean` | Toggles the 2 px/10 px-radius outer container. Precedence: a `?standalone=` URL param wins over this prop, which wins over the `true` default. Pass `standalone={!isEmbedded}` so an embedded sim lets AP supply the chrome; `?standalone=false` still overrides the prop to force it off (testing/preview). |
| `onInfoOpenChange?` | `(open: boolean) => void` | Fires when the About panel opens/closes. |

Slots: `<SimulationFrame.Trials>`, `<SimulationFrame.Simulation>`, `<SimulationFrame.Data>`. Each
takes an optional `title` override (defaults `"Trials"` / `"Simulation"` / `"Data"`); `.Simulation`
also takes `instruction?: ReactNode` (shown in its title chip after a `•`). The About panel is a
draggable, **non-modal** `complementary` landmark — see [accessibility.md](../../docs/accessibility.md).

```tsx
<SimulationFrame simTitle="Bananas" tagline="An interactive genetics simulation" infoModalContent={<About />}>
  <SimulationFrame.Trials>{/* TrialCards */}</SimulationFrame.Trials>
  <SimulationFrame.Simulation instruction="Select two parents to begin">{/* viz + controls */}</SimulationFrame.Simulation>
  <SimulationFrame.Data>{/* DataSubsections */}</SimulationFrame.Data>
</SimulationFrame>
```

**`<Section>`** — labeled rounded region with a notched title chip. Used internally by each frame
slot; exported for the rare case a sim needs a labeled region inside the Simulation slot. Props:
`title: string`, `instruction?: ReactNode`, `scrollFocusRing?: boolean` (opts the region into the
keyboard-focusable-when-overflowing ring), `className?`, `children`. Generates its heading id via
`useId()` and exposes itself as an `aria-labelledby`'d region.

**`<DataSubsection>`** — a labeled sub-section inside the Data slot. Props: `title: ReactNode`,
`children`. Renders an `<h3>` (no chip) with an automatic 1 px divider between consecutive siblings.
**Not** a `<Section>` variant — different markup/ARIA on purpose.

### Trials

**`<TrialCard>`** — one trial rendered as a `role="option"` inside the consumer's `role="listbox"`.

| Prop | Type | Notes |
| --- | --- | --- |
| `index` | `number` | Letter badge is derived from it (`0→A … 9→J`). |
| `selected` | `boolean` | Drives `aria-selected` + the `.selected` class. |
| `onSelect` | `() => void` | |
| `ariaLabel?` | `string` | Overrides the default `"Trial X"` name — enrich it with trial state. |
| `tabIndex?` | `number` | Roving tabindex: selected → `0`, others → `-1`. |
| `children` | `ReactNode` | Sim-specific per-card body. |

**`<TrialResetButton>`** — the reset affordance for the selected trial, rendered by the sim **outside**
the listbox (a listbox must not own focusable non-options). Props: `letter: string` (for the accessible
name), `onReset: () => void`, `disabled?: boolean`, `tabIndex?: number`, `className?`, `style?`. Uses
`aria-disabled` + a JS guard so it stays keyboard-discoverable when there's nothing to reset. `tabIndex`
comes from `useTrialsKeyboardNav` — the reset shares the *card's* tab stop, so it drops to `-1` while
the roving focus rests on the `+ New` card.

**`<NewTrialCard>`** — the `+ New` card that appends a trial. A native `<button>` named
`"Add new trial"` (Enter/Space activate natively), rendered **outside** the listbox for the same reason
as the reset, while still sharing the column's single roving tab stop. Props: `onAdd: () => void`,
`tabIndex: number`, `onKeyDown`, `onFocus` — the last three all come from `useTrialsKeyboardNav`. It
carries the nav handlers itself because, sitting outside the listbox, it can't inherit the listbox's
delegated handler.

**`<MaxTrialsNotice>`** — replaces `<NewTrialCard>` once `MAX_TRIALS` trials exist. No props. Plain
visible text, deliberately **not** a live region: the cap is narrated once through the sim's single
`<Announcer>`.

> Both ship **no SCSS** — unlike the other shared components, the `+ New` card is themed per sim, so
> each sim's `trials-panel.scss` styles `.new-trial-card` / `-icon` / `-text` and `.max-trials-notice`.
> The *markup* is shared because `useTrialsKeyboardNav` finds its elements by class name
> (`.trial-card`, `.new-trial-card`, `.reset-button`); owning those classes here stops a sim renaming
> one out from under the hook.

### Controls

All controls take optional `action?: string` / `actionParams?: Record<string, unknown>` for
auto-emit, plus `className?`. State styling uses `data-*` attribute selectors, not CSS pseudo-classes.

| Component | Key props | Auto-emit fires |
| --- | --- | --- |
| `<Button>` | extends react-aria `ButtonProps` (`onPress`, `isDisabled`, `type`, `aria-label`, …) | on press |
| `<Slider>` | `value` / `minValue` / `maxValue` / `step` / `onChange` (live) / `onChangeEnd` (commit) / `formatOptions` / `isDisabled` | on commit (`onChangeEnd`), value included as `value` |
| `<NumberField>` | `value` / `minValue` / `maxValue` / `step` / `onChange` / `formatOptions` / `label` / `isDisabled` | on commit (`onChange` = blur/Enter/stepper) |
| `<Switch>` | `isSelected` / `defaultSelected` / `onChange` / `isDisabled` / `children` | on change, new boolean as `value` |
| `<Checkbox>` | `isSelected` / `defaultSelected` / `isIndeterminate` / `onChange` / `isDisabled` / `children` | on change |
| `<Select<K>>` | `options: { id, label }[]` / `selectedKey` / `defaultSelectedKey` / `onSelectionChange` / `placeholder` / `label` / `isDisabled` | on selection change, `value: String(key)` |

`<Button>`'s `isDisabled` is intercepted (not forwarded): a disabled Button keeps its tab stop via
`aria-disabled` + a press guard. The form controls keep react-aria's **native `disabled`** (dropped
from the tab order) — an intentional split, see [accessibility.md](../../docs/accessibility.md).
`<Select>` is generic over the option key type; import `Key` from `react-aria-components`, and use the
exported `SelectOption<K>` (`{ id: K; label: ReactNode }`).

### Charts (hand-rolled SVG — no charting library)

Given an `ariaLabel`, each renders a `role="img"` region named by it (internals `aria-hidden`);
without one the wrapper is role-less/decorative (role and name always travel together). The empty
state renders as plain, announceable text — not an image. Token-themed via CSS classes, responsive
via `ResizeObserver`.

- **`<LineChart<T>>`** — single series over pre-positioned data. Props: `data: readonly T[]`
  (sorted ascending by `xKey`), `xKey` / `yKey` (`keyof T`), `height`, `ariaLabel?` / `xLabel?` /
  `yLabel?` / `emptyState?`. Shows the empty state below 2 points. Multi-series is deferred.
- **`<Histogram>`** — raw `values: readonly number[]`, auto-binned. Props: `values`, `targetBinCount?`,
  `height`, `ariaLabel?` / `xLabel?` / `yLabel?` / `emptyState?`.

### Accessibility

**`<Announcer>` + `useAnnounce()`** — one shared visually-hidden `aria-live="polite"` region per sim.
Wrap the sim in `<Announcer>`; descendants call `const announce = useAnnounce()` and `announce(msg)`.
Queue-backed with a single pending timer and clear-then-re-announce for repeats. Outside a provider
`useAnnounce()` is a safe no-op. This is the **only** live region a sim should have — see
[accessibility.md](../../docs/accessibility.md).

---

## Hooks

### Simulation state

- **`useModelState<IInput, IOutput, ITransient>({ initialInput, initialOutput, initialTransient })`**
  → `{ input, output, transient, setInput, setOutput, setTransient, resetTransient, resetOutput,
  resetAll }`. Three typed state shapes — `input` (user parameters), `output` (per-trial accumulated
  record), `transient` (per-frame model state). Setters use `useState` value-or-updater semantics.
  Reset helpers cover the transitions: `resetTransient` between trials, `resetOutput` to clear stats,
  `resetAll` on full reset. Owns the *running* trial's state; MST owns the trial **list**.
- **`useSimulationRunner({ onStep, stepDeltaMs? })`** → `{ isPlaying, play, pause, step }`. Play/pause/
  step lifecycle over `useFrameLoop`. `onStep(deltaMs)` runs every animation frame while playing and
  once per `step()`. `stepDeltaMs` defaults to 16.
- **`useFrameLoop(callback: (deltaMs: number) => void, enabled: boolean)`** — `requestAnimationFrame`
  wrapper with cleanup + frame-time delta. `callback` is captured via ref (updating it doesn't restart
  the loop); the schedule cancels when `enabled` flips false or on unmount.

### AP embedding & accessibility

- **`useLogEvent()`** → `LogEvent` = `(eventName: string, parameters?: Record<string, unknown>) => void`.
  Stable across renders. Dual-transport: portal-report (when embedded) + GA4 `gtag` (when configured).
  In dev, validates the event name (snake_case, ≤ 40 chars) and params (≤ 25 keys, values ≤ 100 chars)
  and throws; in prod it silently drops a bad event.
- **`useReloadWarning(enabled: boolean)`** — arms a `beforeunload` confirmation while `enabled`.
- **`useScrollFocusRing<T>(externalRef?)`** → a **callback ref**. Adds `tabindex="0"` only while the
  element overflows (`scrollHeight > clientHeight`); pair with a `.scroll-focus-ring` sibling for the
  inset `:focus-visible` ring. Pass an existing `RefObject` to share one element.
- **`useScrollSelectedTrialIntoView<T>(selectedLetter: string)`** → a `RefObject` to put on the trials
  scroller; scrolls the `.trial-card-wrapper.selected` card into view when `selectedLetter` changes.
- **`useTrialsKeyboardNav<T>({ containerRef, letters, selectedIndex, canAddTrial, selectLetter })`** —
  roving-tabindex keyboard nav making the whole Trials column a **single tab stop**: the cards *and*
  the `+ New` card share one roving tab stop, and `+ New` joins the arrow ring as the node just past
  the last card (`… ↓ last card ↓ + New ↓ first card ↓ …`, wrapping). `Home` → first card; `End` →
  `+ New` (or the last card at the cap). Moving onto a card moves focus **and** selection; moving onto
  `+ New` moves focus only (it isn't selectable). Returns:

  | Returns | Attach to |
  | --- | --- |
  | `onKeyDown`, `onFocus` | the **listbox** (delegates for the cards) **and** `<NewTrialCard>` |
  | `selectedCardTabIndex` | the selected `<TrialCard>` (unselected cards are always `-1`) |
  | `newCardTabIndex` | `<NewTrialCard>` |
  | `resetTabIndex` | `<TrialResetButton>` |
  | `focusAddedTrial()` | call after adding a trial — moves focus onto the new card |

  Do **not** hang the handlers on the panel wrapper: it's a non-interactive `<div>` (and would trip
  `a11y/noStaticElementInteractions`). Because the hook selects on `.trial-card` / `.new-trial-card` /
  `.reset-button`, use the shared components rather than re-rolling the markup.

### Utility hooks

- **`useInterval(callback: () => unknown, delay: number | null)`** — `setInterval` with a `null` pause.
- **`useCurrentAndPrevious<T>(value)`** → `readonly [current, previous?]`.
- **`useStateWithCallback` / `useStateWithCallbackInstant` / `useStateWithCallbackLazy`** — set-state
  then run a callback with the new value, without an extra `useEffect`.

---

## Trial-list infrastructure

The universal multi-trial logic, so each sim only defines its own per-trial `TrialModel`. Sims manage
the trial list with **MST**; these helpers operate on the MST `types.map` and the shared `UiStore`.

- **`TRIAL_LETTERS_DEFAULT`** (`["A" … "J"]`), **`MAX_TRIALS_DEFAULT`** (`10`), **`TrialLetter`** type.
- **`UiStore`** — MST model holding `selectedTrialLetter` (an A–J `types.enumeration`, default `"A"`)
  with a `selectTrial(letter)` action. Compose your own UI state on top via `types.compose` rather
  than duplicating the letter. **`UiStoreInstance`** = `Instance<typeof UiStore>`.
- **`activeTrial(trials, selectedTrialLetter)`** → the selected trial; never throws — falls back to
  the first trial if the letter dangles.
- **`canAddTrial(trials)`** → `boolean` (`size < 10`).
- **`addTrial(trials, createTrial)`** → the new letter, or **`null` at the cap** — callers must gate on
  the return. `createTrial` instantiates the sim's own `TrialModel`.
- **`trialLetters(trials)`** → `readonly string[]`. **`hasAnyProgress(trials, isProgress)`** → `boolean`
  (each sim defines "progress"; drives the reload warning). **`TrialsMap<T>`** — the read-only map shape
  these accept.
- **`toVersionedSavedState(version, snap)`** → `{ version, trials, selectedTrialLetter }`, the flat
  persisted envelope projected from a root snapshot (drops transient UI state). Each sim still owns its
  own `migrateSavedState`. **`VersionedSavedState<TTrials>`** type.

---

## Utilities

- **Seeded random** (`seedrandom`-backed, keyed cache for reproducible sims): `seededRandom(key)` →
  a callable `SeededRandom` (`rng()` → next `[0,1)`, `.state()` for save/restore). `saveSeededRandom(key)`
  → `SeededRandomState`, `restoreSeededRandom(key, state)`, `resetSeededRandom(key)`, `resetAll()`.
  Inject the PRNG via the MST environment so tests pass a seeded instance.
- **Reduced motion**: `prefersReducedMotion()` → `boolean`; `smoothScrollIntoView(el)` — smooth scroll
  that degrades to instant when the user prefers reduced motion.

---

## Styles

`tokens.scss` is the single source of truth for color, spacing, typography, radii, and dimensions —
nothing outside it should hard-code these values. Component SCSS does `@use "../../styles/tokens" as
tokens;` for variable access; `global.scss` (imported **once** per sim entry) is the only file that
emits the runtime `:root { --foo: … }` mirror, so the custom-property block isn't duplicated across
separately-compiled component stylesheets. The UI Design Plan owns the concrete values
([ui-design-plan.md §13](../../docs/ui-design-plan.md)).

---

## Build helpers

- **`createSimViteConfig({ port })`** → the shared Vite config every sim's `vite.config.ts` uses. Sets
  `base: "./"`, the `svgrPlugin()` + `react()` + `gtagInjector()` + `widthPreviewPlugin()` plugins, the
  `renderBuiltUrl` expression that makes JS-emitted asset URLs resolve relative to the chunk (for
  top-level release promotion — see [infrastructure-plan.md §8](../../docs/infrastructure-plan.md)),
  and asset hashing.
- **`gtagInjector()`** — replaces the `<!--GA-->` placeholder in `index.html` with the gtag snippet when
  `VITE_GA_PROPERTY_ID` is set at build time; strips it when unset.
- **`svgrPlugin()`** — the `?react` SVG transform (svgo disabled so `fill="currentColor"` and `viewBox`
  survive). Needed by every consumer that bundles or tests this package — see below.
- **`widthPreviewPlugin()`** — serves the dev-only width preview at `/__preview` (see below). Already
  included by `createSimViteConfig()`; a sim never wires it up itself.
- **`createSimVitestConfig()`** → the shared jsdom Vitest config (`globals: false`, `css: false`, etc.).

---

## Width preview (`/__preview`)

Every sim's dev server serves a **width preview** — the sim rendered in an `<iframe>` at each of the
four widths it has to work within. Start any sim and open the URL the banner prints:

```
$ yarn workspace bananas dev
  ➜  Local:         http://localhost:8080/
  ➜  Width preview: http://localhost:8080/__preview
```

There is nothing to install or configure: the plugin ships inside `createSimViteConfig()`, so a sim
scaffolded by `yarn new-sim` has it from the first run. It's `apply: "serve"`, so it contributes
nothing to `vite build` and can never reach `dist/`.

The page renders one card per entry in `TARGET_WIDTHS`, each a **real, interactive instance** of the
sim (they're independent — clicking in one doesn't affect the others):

- **Standalone toggle** per card, defaulting to the mode's true value (standalone only at 1024). It
  drives the sim's existing `?standalone=true|false` URL override.
- **Zoom** (default: fit to window) scales the frames with a CSS transform. Each iframe still *lays
  out* at its true pixel width — only the rendering shrinks — so what you see is the real layout,
  merely drawn smaller. Zoomed out, the cards wrap and sit side by side for comparison.
- **Reload**, per card or all at once, for a clean sim instance.

It also flags the layout problems an iframe would otherwise **hide** rather than advertise — a
too-tall sim just gets a scrollbar, clipped text just looks like shorter text, and content escaping
the frame is silently cut off by the standalone container's `overflow: hidden`:

| Warning | Means |
| --- | --- |
| `Content doesn't fit — 18 px too tall` | The sim renders past the box AP gives it. |
| `Text is clipped in 1 element: …` | Text hard-clipped by a hidden overflow (an intentional `ellipsis` doesn't count). |
| `2 elements outside the frame: …` | Content rendering past the frame's left/right edge. Only the outermost offender is named. |

A healthy sim is silent, so anything it says is a real finding — it caught a genuine 767-px-only
overflow in `starter`'s data panel the first time it was pointed at it.

> **Deliberately not checked: touch-target minimums.** The naive test (bounding box < 44 px) fires on
> react-aria's visually-hidden inputs and on controls that expand their hit area with an `::after`
> pseudo-element, so it reports violations on a compliant sim. Doing it right means resolving each
> control's *effective* hit target, and belongs with the planned axe-based a11y auditing.

**`TARGET_WIDTHS`** (`src/layout/target-widths.ts`) is the source of truth for the four widths in
TypeScript — consumed by this page and by the root `playwright.config.ts`, whose project matrix runs
the whole e2e suite once per width. It's a **pure** module (no component/SCSS/SVG imports) so
Playwright's tsconfig can import it directly rather than through the barrel. `tokens.scss` necessarily
carries its own copy, since SCSS can't read TypeScript; change one, change the other.

---

## SVG / icon imports

Two import styles, chosen by what the SVG is for:

| Import | Resolves to | Use for |
| --- | --- | --- |
| `import url from "./icon.svg"` | a hashed URL string | multi-color / brand art rendered via `<img src={url}>` (e.g. the DESE + Concord Consortium logos) |
| `import Icon from "./icon.svg?react"` | a React component | monochrome icons that need to be themed |

A `?react` icon should paint with `fill="currentColor"` in the asset, so the rendered glyph takes its
color from its container's CSS `color`. That's how a sim recolors an icon without touching the shared
asset — e.g. the Bananas About panel themes its info/close glyphs by setting `color` on
`.modal-header-icon` / `.modal-close-icon`.

```tsx
import InfoIcon from "../assets/info-icon.svg?react"; // <svg><path fill="currentColor" …/></svg>

<InfoIcon className="modal-header-icon" aria-hidden="true" />;
```

```scss
.modal-header-icon {
  color: #5c4813; // recolors the glyph
}
```

### Build wiring

The `?react` transform comes from `vite-plugin-svgr`, exposed as `svgrPlugin()` in
[`src/vite-config.ts`](./src/vite-config.ts) (svgo is disabled so `fill="currentColor"` and the
`viewBox` survive untouched). Because these imports live in this package's source, **every** consumer
that bundles or tests it needs the plugin:

- **Vite build** — `createSimViteConfig()` already includes it; an inline config adds `svgrPlugin()` to
  its `plugins` array.
- **Vitest** — add `svgrPlugin()` to the jsdom config's `plugins` (needed by any test that renders a
  component using a `?react` import).
- **tsconfig** — add `"vite-plugin-svgr/client"` to `compilerOptions.types` so `tsc` resolves the
  `*.svg?react` module.

New sims scaffolded with `yarn new-sim` inherit all of this from the starter template, so no manual
setup is required.
