# Mass Sims — Infrastructure Plan

**Status:** Infrastructure and shared library complete; first sim shipped. The shared library exposes the full §3 surface — `SimulationFrame` (with the draggable, non-modal About panel, superseding the earlier centered-modal skeleton), `Section`, `TrialCard`, `DataSubsection`, the react-aria control wrappers (`Button`/`Slider`/`NumberField`/`Switch`/`Select`/`Checkbox`), the hand-rolled `LineChart`/`Histogram`, the hooks, and the MST-based trial-list infrastructure. The `starter` template and **Bananas** (the first full sim) are essentially complete, and the CI/CD + per-sim S3 deploy pipeline is in place. This plan remains the source of truth for infrastructure decisions; forward-looking sections describe intent that later work may refine.
**Date:** May 26, 2026 (last reconciled against the code July 7, 2026)
**Author:** Plan assembled by Claude based on analysis of `foss` and `dese-models`
**Scope:** Tooling, file structure, dependencies, build, CI/CD, hooks API, deployment, transferability. **Visual design lives in a separate document — [UI Design Plan](./ui-design-plan.md)** — and iterates on a different cadence.
**Reference repos analyzed:**
- `/Users/emcelroy/Documents/webdev/foss` (FOSS Simulations — 11 sims, simpler)
- `/Users/emcelroy/Documents/webdev/dese-models` (DESE Models — 42 sims, more sophisticated, TestNav-coupled)

---

## 1. Executive summary

The new project is a monorepo that hosts a growing set of educational science simulations. **At least four are planned for the initial release, but the collection is expected to grow significantly over time — potentially to 20+ simulations.** That growth expectation shapes several design decisions throughout this plan (scaffolding, CI structure, shared-library API stability, root index page generation), even though it does not change the starting tooling. Each simulation is a standalone, statically deployed web app that shares a common component library and a "starter simulation" template. The project follows the FOSS repo's overall structural model (it is already free of the features we want to exclude), pulls selected performance and code-quality improvements from DESE, and upgrades the tooling baseline to modern (2026) defaults.

The shared library exposes a `<SimulationFrame>` compound component with three named slots — **Trials**, **Simulation**, **Data** — that every simulation drops its content into. Visual specifics (layout, dimensions, regions, responsive behavior) live in the [UI Design Plan](./ui-design-plan.md); the API contract that's stable enough to build against is in §3 of this plan.

### High-level recommendation

| Decision | Recommendation | Why |
| --- | --- | --- |
| Base repo to clone from | **FOSS** | Already lacks the features we want excluded (auth, TestNav, read-aloud, color-blind themes); cleaner structure |
| Improvements to backport from DESE | `useFrameLoop`, `useStateWithCallbackLazy`, `seeded-random`, frame-rate limiting pattern in `app.tsx`, V2 control components (selectively) | These are real perf wins absent from FOSS |
| Framework | React 19.2 | Current stable; concurrent features, Actions, automatic memoization compiler |
| Language | TypeScript 6.x | Strict-by-default; stays on 6 rather than 7 beta until 7 ships stable |
| Build tool | **Vite 8** (replacing Webpack 5) | ~24x faster HMR, ~3-5x faster prod builds, ~38 lines of config vs 110+. Already in production at CC in `accessibility-tools` and `datagoat`. (Started at Vite 6; bumped to 8 during Phase 1 to align with `@vitejs/plugin-react@^6` — see §7.) |
| Package manager | **Yarn 1.x workspaces** (unchanged from FOSS) | Avoid adding a third package manager (pnpm) to the CC toolkit; existing repos use Yarn. |
| Monorepo orchestrator | **Lerna 4** (unchanged from FOSS) | Works for our scale (~6 packages). Turborepo is easy to layer in later if package count grows past ~10. |
| UI component library | **react-aria-components** (Adobe) — MUI was evaluated and dropped | Headless, fully-accessible primitives; every shared control is a thin token-styled wrapper. Resolves the earlier MUI-vs-skip-MUI question — see §7 and §11 #9. |
| Styling | Plain (global) SCSS, side-effect imported, scoped under a per-component root class (continuation of existing approach) | Matches the house convention (DESE uses ~450 plain `.scss` files, zero CSS Modules); no reason to churn. *(Earlier drafts said "SCSS Modules" — corrected once DESE's actual convention was verified during Phase 1.)* |
| Unit testing | **Vitest** (replacing Jest) | Comes essentially free with Vite — same transform pipeline. Running Jest with Vite is more work than just using Vitest. |
| E2E testing | **Playwright** (replacing Cypress) | Already the cross-org migration target; not counted toward the change budget. |
| Lint + format | **Biome** (replacing ESLint; adds formatting we didn't have) | Already in production at CC; Engineer 2 confirms "crazy fast." One tool instead of two configs per package. |
| Git precommit hooks | **Lefthook** (new — neither reference repo had hooks) | Already a CC standard in newer repos. Minor addition, big QoL win. |
| Accessibility tooling | `@axe-core/react` in dev, Biome's `a11y` rule group, keep `focus-trap` and `@dnd-kit` | Keeps accessibility as a first-class concern without the color-blind theme system. **Caveat:** verify Biome's a11y rules cover what `eslint-plugin-jsx-a11y` did before fully committing — see Risks. |
| Deployment | GitHub Actions with **OIDC** → S3 `models-resources` bucket, `mass-sims/` subfolder | Follows the pattern from [`concord-consortium/starter-projects`](https://github.com/concord-consortium/starter-projects/blob/main/doc/deploy-setup.md) |
| Iframe embedding | `iframe-phone` (Concord's parent ↔ child messaging library) | Sims will run as iframe interactives inside Activity Player as well as standalone |
| Action logging | `@concord-consortium/lara-interactive-api` (portal-report) **+** GA4 `gtag.js` | Single emit point in `useLogEvent`, two transports. Portal-report fires when embedded; GA fires when a repo-wide property ID is configured. Same event vocabulary. |
| Transferability | Designed for handoff to DESE (org) hosting | Fully static build, no hard-coded CC URLs, opt-out logging (both transports), deployment docs — covered as a design constraint, not yet a delivery |
| Devices, dimensions, visual design | See [UI Design Plan](./ui-design-plan.md) | Layout, dimensions, regions, responsive behavior, palette, touch hit targets live in the companion doc |

---

## 2. Repository layout

```
mass-sims/                              ← repo root (concord-consortium/mass-sims)
├── package.json                        ← yarn + lerna root, `workspaces` field
├── lerna.json
├── tsconfig.base.json                  ← shared TS settings
├── biome.json                          ← Biome (lint + format) config
├── lefthook.yml                        ← git precommit hooks
├── .github/workflows/                  ← CI/CD (build, test, OIDC-based S3 deploy)
├── index.html                          ← landing page linking to each sim
│
├── packages/
│   ├── shared/                         ← THE common library (≈ FOSS `common/`)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── simulation-frame/   ← 3-column layout shell
│   │   │   │   ├── section/            ← labeled-section wrapper (title chip + rounded body)
│   │   │   │   ├── simulation/         ← simulation region primitives
│   │   │   │   ├── trials-list/        ← vertical scrollable trials list + trial row
│   │   │   │   ├── data-panel/         ← data region (table, charts, sub-sections)
│   │   │   │   ├── controls/           ← buttons, sliders, toggles, selects
│   │   │   │   ├── dialog/             ← info/credits/reload-warning modals
│   │   │   │   └── drag-and-drop/      ← @dnd-kit wrappers
│   │   │   ├── hooks/
│   │   │   │   ├── use-model-state.ts        ← from FOSS, refined
│   │   │   │   ├── use-simulation-runner.ts  ← from FOSS
│   │   │   │   ├── use-frame-loop.ts         ← from DESE (perf)
│   │   │   │   ├── use-state-with-callback.ts ← from DESE
│   │   │   │   ├── use-interval.ts          ← from DESE
│   │   │   │   ├── use-current-and-previous.ts← from DESE
│   │   │   │   ├── use-iframe-phone.ts       ← parent ↔ child messaging
│   │   │   │   ├── use-log-event.ts          ← portal-report logging via lara-interactive-api
│   │   │   │   └── use-reload-warning.ts     ← beforeunload confirmation
│   │   │   ├── utils/
│   │   │   │   ├── seeded-random.ts        ← from DESE (deterministic sims)
│   │   │   │   └── reduced-motion.ts       ← prefers-reduced-motion helpers
│   │   │   ├── styles/
│   │   │   │   ├── tokens.scss             ← design tokens (demo-derived palette, no CSS output)
│   │   │   │   └── global.scss             ← :root custom properties; imported once per sim entry
│   │   │   └── index.ts
│   │   ├── package.json                ← name: @concord-consortium/mass-sims-shared
│   │   └── tsconfig.json
│   │
│   └── starter/                        ← THE re-usable starter simulation
│       ├── src/
│       │   ├── components/
│       │   │   ├── app.tsx             ← composes SimulationFrame + trials/simulation/data
│       │   │   ├── simulation-view.tsx ← simulation region content (canvas/SVG/Three)
│       │   │   ├── controls.tsx        ← simulation region controls (below the viz)
│       │   │   ├── trial-row.tsx       ← single trial item in the vertical list
│       │   │   └── data-view.tsx       ← data panel content (one or more sub-sections)
│       │   ├── model.ts                ← physics/logic
│       │   ├── types.ts                ← IModelInputState, IModelOutputState
│       │   ├── config.ts               ← simulation config / defaults
│       │   └── index.tsx               ← entry
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── simulations/                        ← per-simulation workspaces, one per sim
│   ├── sim-one/                        ← scaffolded via `yarn new-sim sim-one`
│   ├── sim-two/
│   ├── sim-three/
│   ├── sim-four/
│   └── …                               ← grows to 20+ over time
│
├── scripts/
│   ├── new-sim.ts                      ← scaffolds a sim from packages/starter
│   └── gen-index.ts                    ← regenerates the root index.html from sim list
│
└── tests-e2e/                          ← Playwright suite, root-level
    └── ...
```

Notes on the layout:

- **`packages/starter` is a real package, not just a template.** New simulations are scaffolded via `yarn new-sim <name>` (a small `scripts/new-sim.ts`) that copies the starter and rewrites the relevant `package.json` and config fields. This keeps the starter testable and lintable, and — crucially given the 20+ sim growth expectation — makes adding a new sim a one-command operation rather than a multi-step copy-paste-edit ritual.
- **`packages/shared` exports a single barrel.** Simulations import as `import { SimulationFrame, useModelState } from "@concord-consortium/mass-sims-shared"`.
- **No router.** Each simulation is a separately deployed bundle; the root `index.html` is **auto-generated** by `scripts/gen-index.ts` from the workspace list in `package.json`. Avoids the DESE pattern of duplicating the sim list in multiple places (CI workflows, index page, deploy scripts).
- **Single fixed monorepo version.** Every package in the repo shares one version number, bumped at release time. Simpler than Lerna's independent versioning, and keeps versioned deploy URLs aligned across sims.
- **Sim naming convention.** Lowercase kebab-case, descriptive (e.g. `bananas`, `kitchen-lab`), no `mass-sims-` prefix. The package name is `<sim-name>` (unscoped, like FOSS). Once at 20+ sims, the convention pays off.

---

## 3. Shared library API surface (the `SimulationFrame` contract)

> **Visual design lives in a separate document.** Dimensions, region styling, responsive behavior, touch hit targets, color palette, and per-region visual decisions are owned by the **[UI Design Plan](./ui-design-plan.md)**, which iterates on a different cadence than this infrastructure plan. This section defines only the *API surface* the shared library exposes, because Phase 1/2 work needs that contract to start.

### `<SimulationFrame>` compound component

Built in `packages/shared/src/components/simulation-frame/`. Compound API with three named slots, one header row, and an info ("About") modal:

```tsx
<SimulationFrame
  simTitle="Bananas"
  tagline="An interactive genetics simulation"
  infoModalContent={<BananasInfo />}
>
  <SimulationFrame.Trials>
    {trials.map((t, i) => (
      <TrialCard key={t.id} index={i} selected={t.selected} onSelect={...} onReset={...}>
        ...sim-specific per-trial content (parent labels, offspring counts, etc.)...
      </TrialCard>
    ))}
  </SimulationFrame.Trials>

  <SimulationFrame.Simulation instruction="Select two parents to begin">
    <SimulationView />
    <SimulationControls />
  </SimulationFrame.Simulation>

  <SimulationFrame.Data>
    <DataSubsection title="Offspring Phenotypes: All Generations">...</DataSubsection>
    <DataSubsection title="Fungus Resistance over Generations">...</DataSubsection>
  </SimulationFrame.Data>
</SimulationFrame>
```

The three regions are **Trials** (left), **Simulation** (center), and **Data** (right). Each renders inside a `<Section>` wrapper that the frame supplies. The Trials slot additionally wraps its children in a vertically-flexed `.trials-list` container, so multiple `<TrialCard>` children stack with consistent spacing without the sim having to add the layout container itself. The canonical slot label can be overridden per-sim via `<SimulationFrame.Simulation title="Lab">` etc. — slot *identity* (component name, grid-area) stays canonical; only the visible label diverges.

**Notes on the header.** `<SimulationFrame>` renders a single 50 px **title bar** at the top of the sim that contains, left to right: `simTitle` (Lato 24 / 28 px bold), `tagline` (Lato 16 / 20 px), the project-wide partner-branding cluster (DESE + Concord Consortium logos), and the **About** button. The partner-branding cluster is identical across every Mass Sims sim — it ships as SVGs inside `packages/shared` and is rendered internally by `<SimulationFrame>` rather than passed in as a prop. The teal **"[Sim Name] Simulation"** bar above is rendered by Activity Player's wrapper chrome, not by us, so `<SimulationFrame>` has no `projectName` prop and does NOT render that row even in standalone deploys.

**Notes on the standalone container.** `<SimulationFrame standalone?>` — see §7 of the [UI design plan](./ui-design-plan.md) for the three-column flex layout. The optional `standalone` prop (default `true`) toggles a 2 px / 10 px-radius outer container; sims derive it from embed detection (`standalone={!isEmbedded}`) so an AP-embedded sim suppresses the container and AP's chrome is the only one. A `?standalone=` URL param overrides the prop for testing/preview.

**Notes on the About panel.** Triggered from the About button. Renders as a **draggable side panel** anchored top-right (`width: 400 px`, `max-height: 70 %`), not a centered backdrop overlay — the user can drag it around to keep the sim content visible. Key properties:

- **Non-modal** (`role="dialog"` only, no `aria-modal`). The sim content behind the panel stays interactive — that's the whole point of a draggable panel. `aria-labelledby` still wires the panel's heading to the dialog so screen readers announce it on open.
- **Frame-anchored**, not viewport-anchored. The panel renders inline as a child of `.simulation-frame` (which is `position: relative`), so a sim that renders multiple frames keeps each panel attached to its own frame's corner. `createPortal` is intentionally NOT used.
- **No backdrop scrim.** The sim content behind it is fully visible and interactive.
- **Drag position resets on each open** — always reappears at the default top-right offset (50 px from top, 10 px from right).
- **Toggle**: clicking the About button while the panel is open closes it.
- **Keyboard dragging**: Alt+Arrow nudges by 10 px (Shift+Alt+Arrow uses a 40 px step). Required to keep the affordance keyboard-accessible.
- **Drag-listener hygiene**: pointer-drag attaches `pointermove` / `pointerup` to `window`; a `dragCleanupRef` + unmount effect detaches them if the frame unmounts mid-drag.

This is the only dialog in the sim that uses the panel pattern. The future shared `<Dialog>` (Phase 3), used for the reload-warning confirmation and any other modals, is a conventional centered overlay with backdrop scrim and full modal semantics (`aria-modal="true"`).

### `<Section>` component

Exported from the shared library; the title-chip primitive used by each frame region (rendered by `<SimulationFrame>` internally). Not normally rendered directly by sims — the Data slot's sub-sections use `<DataSubsection>` (see below), and the Trials slot's per-trial items use `<TrialCard>`. Section is exported anyway because it's a useful primitive if a sim needs a labeled region inside the Simulation slot (rare).

```tsx
<Section title="Offspring Phenotypes">...content...</Section>
```

The chip is a real DOM element (not pure decoration), notched onto the top edge of the panel: ~36 px tall, 8 px border-radius, 2 px border, centered horizontally with the chip half-overlapping the panel border. The bullet separator (`•`) between the title and the optional `instruction` is rendered by Section's own CSS via `::before` on the instruction element — consumers don't think about it. Section generates a per-instance heading id via `useId()`, so multiple sections (even multiple frames) on one page stay uniquely labeled with no caller-supplied id, and `aria-labelledby` exposes the section as a named landmark.

### `<TrialCard>` component

Exported from the shared library; rendered by each sim inside `<SimulationFrame.Trials>` for every recorded trial.

```tsx
<TrialCard index={i} selected={t.selected} onSelect={...} onReset={...}>
  ...sim-specific per-trial content...
</TrialCard>
```

The frame provides the common chrome: a 120 × 136 px card with a **letter badge** in the upper-left (auto-derived from `index`: 0→A, 1→B, …, 9→J), a 2 px border, selected/hover/active states, and — when `selected` — a 44 × 44 px **reset** affordance in the upper-right that calls `onReset` and is auto-disabled when there's nothing to reset (the parent can also pass `resetDisabled` to override). Sim-specific per-trial content (parent labels, offspring counts, healthy/infected percentages) renders as `children` inside the card. Sims own the trial state; the card owns the affordance shape.

The plan currently expects trials A through J (up to 10), matching the demo. If a sim eventually needs more, `letter` becomes a direct prop and `index` is recomputed by the sim.

### `<DataSubsection>` component

Exported from the shared library; rendered by each sim inside `<SimulationFrame.Data>` to denote a labeled sub-section of the Data panel (e.g. the pie-chart half and the line-graph half in Bananas).

```tsx
<DataSubsection title="Offspring Phenotypes: All Generations">
  <PieChart .../>
  <Legend .../>
</DataSubsection>
```

Unlike `<Section>`, `<DataSubsection>` does NOT render a chip. The title is a real heading element (`<h3>` — semantically a sub-heading under the Data region's `<h2>`), centered above the content, with a 1 px horizontal-rule divider rendered automatically between consecutive `<DataSubsection>` siblings. Sims may render any number of `<DataSubsection>` siblings (one, two, three, more). **`<DataSubsection>` is not a `<Section>` variant** — the markup, ARIA structure, and visual treatment differ on purpose; consumers should not try to reconcile the two by configuring `<Section>` for the Data slot.

### `<Button>` component

Exported from the shared library; the first wrapper around a `react-aria-components` primitive per the [Shared controls policy](#shared-controls-policy) below. Used wherever a sim needs an interactive press button.

```tsx
<Button action="play_pressed" actionParams={{ trial: "A" }} onPress={play}>
  Play
</Button>
```

Props: `action?: string` (snake_case event name; omitted disables logging), `actionParams?: Record<string, unknown>`, plus all react-aria `ButtonProps` (`isDisabled`, `onPress`, `aria-label`, `type`, …). The wrapper applies token-driven hover/press/focus/disabled treatment (via `data-hovered` / `data-pressed` / `data-disabled` attribute selectors, not CSS pseudo-classes), auto-emits via `useLogEvent` when `action` is present, and forwards everything else to react-aria unchanged. Visual variants are intentionally not exposed yet — the demo uses one button shape everywhere; Phase 3 may add `variant?: …` if a control needs a lower-emphasis treatment.

### Form controls — `<Slider>`, `<NumberField>`, `<Switch>`, `<Select>`, `<Checkbox>`

The Phase 3 form controls, each a thin react-aria-components wrapper per the [Shared controls policy](#shared-controls-policy). All take optional `action?` / `actionParams?` for auto-emit and forward the rest to the primitive; state styling uses `data-*` attribute selectors (not CSS pseudo-classes).

- **`<Slider>`** — wraps rac `Slider`. `value` / `minValue` / `maxValue` / `step` / `onChange` (fires live during drag, for UI updates) / `onChangeEnd` (commit) / `formatOptions`. Auto-emits **on commit (`onChangeEnd`), not during drag** (§11 #28), with the committed value included as `value`. Two-tone track (dark fill left of the thumb).
- **`<NumberField>`** — wraps rac `NumberField` (− / + stepper buttons around a text input). `value` / `minValue` / `maxValue` / `step` / `onChange`. Auto-emits on commit (`onChange`, which rac fires on blur / Enter / stepper press). Note: rac's `step` controls both the stepper increment **and** snaps typed values to that granularity.
- **`<Switch>`** — wraps rac `SwitchField` + `SwitchButton` (the flat `Switch` is deprecated in rac ^1.18). Boolean toggle (rocker). `isSelected` / `onChange`. Auto-emits on `onChange` with the new boolean as `value`.
- **`<Select>`** — wraps rac `Select` (trigger button + portaled popover listbox). Generic over the option key type. `options: { id, label }[]` / `selectedKey` / `onSelectionChange`. Auto-emits on selection change with `value: String(key)`. Import the `Key` type from `react-aria-components`, not `react`.
- **`<Checkbox>`** — wraps rac `CheckboxField` + `CheckboxButton` (flat `Checkbox` deprecated). Boolean toggle (square box); supports `isIndeterminate`. `isSelected` / `onChange`. Auto-emits on `onChange`.

### `<LineChart>` and `<Histogram>` — hand-rolled SVG charts

No charting library (§11 #19). Each renders — **when given an `ariaLabel`** — a `role="img"` region named by it (the SVG internals are `aria-hidden`); with no `ariaLabel` the wrapper is decorative/role-less rather than an unlabeled image, and the empty/no-data state is plain announceable text (never `role="img"`). Full-width gridlines (no plot-border box), token-driven theming via CSS classes on the SVG primitives, and responsive width via `ResizeObserver`.

- **`<LineChart>`** — single-series line over pre-positioned data. `data` / `xKey` / `yKey` / `height`, plus optional `ariaLabel` / `xLabel` / `yLabel` / `emptyState`. Renders a `<polyline>` + circle markers; shows the empty state when there are < 2 points. Multi-series + legend + marker styling are deferred until a sim needs them.
- **`<Histogram>`** — takes raw `values: readonly number[]` and **auto-bins** them into round-width bins (via `histogramBins` / `niceStep` helpers co-located with the component, internal — not a public util). `values` / `targetBinCount` / `height`, plus optional `ariaLabel` / `xLabel` / `yLabel` / `emptyState`. The raw-values input (vs. pre-categorized data) distinguishes it from a future categorical `<BarChart>`.

### AP state sync

Sims wire Activity Player state sync by importing from `@concord-consortium/lara-interactive-api` **directly** — `useInitMessage` for the saved-state restore on init, `setInteractiveState` to push new state up during the sim's lifetime, and `useAuthoredState` if the activity has author-supplied configuration. The library handles standalone-vs-embedded detection internally: in standalone mode `useInitMessage()` stays `null` and `setInteractiveState()` is a no-op, so no extra guards are needed. (lara-interactive-api also offers a combined `useInteractiveState` `[state, setState]` hook; mass-sims sims keep state in their own React tree and push it via `setInteractiveState` in an effect, which composes more cleanly with the existing trial-list state.)

See `docs/adding-a-new-sim.md` for the canonical wiring pattern (worked example with the restore-on-init and push-on-change effects in context).

### Hooks contract

Exported from `packages/shared/src/hooks/`:

- `useModelState<IInput, IOutput, ITransient>({ initialInput, initialOutput, initialTransient })` — returns `{ input, output, transient, setInput, setOutput, setTransient, resetTransient, resetOutput, resetAll }`. Three typed state shapes: input (user-controlled parameters), output (per-trial accumulated record), transient (per-frame model state). Setters follow standard React semantics (value or updater). Three reset helpers: `resetTransient` between trials, `resetOutput` to clear accumulated stats, `resetAll` on full sim reset. Trial-list management is the sim's responsibility (no built-in trial-list state).
- `useSimulationRunner({ onStep, stepDeltaMs })` — returns `{ isPlaying, play, pause, step }`. Composes `useFrameLoop` underneath. `onStep` runs on every animation frame while `isPlaying` and once per `step()` invocation; `stepDeltaMs` defaults to 16 ms.
- `useFrameLoop()` — `requestAnimationFrame` wrapper with cleanup + frame-time delta.
- `useStateWithCallback()` / `useStateWithCallbackLazy()` — set-state-then-do-X.
- `useInterval()`, `useCurrentAndPrevious()` — small utility hooks.
- `useLogEvent()` — returns `LogEvent`, `(eventName: string, parameters?: Record<string, unknown>) => void`. Stable across rerenders. Dual-transport: portal-report via lara-interactive-api `log(action, data)` (when embedded), GA4 via `window.gtag('event', …)` (when the gtag snippet has loaded — `VITE_GA_PROPERTY_ID` configured at build time). Each transport no-ops independently when not configured. In dev, validates the event name (snake_case, ≤ 40 chars) and params (≤ 25 keys, values ≤ 100 chars) and throws on violation; in prod the validation is skipped so a misnamed event silently drops rather than crashing the sim. See §5 for detail.
- `useReloadWarning()` — `beforeunload` confirmation when at least one trial is recorded.

### Utilities

Exported from `packages/shared/src/utils/`:

- `seeded-random.ts` — deterministic random for reproducible sims.
- `reduced-motion.ts` — `prefersReducedMotion()` plus a `smoothScrollIntoView` helper that respects it.

### Design tokens

`packages/shared/src/styles/tokens.scss` is the single source of truth for color, spacing, typography, corner radii, section-chip dimensions, and the `--touch-target-min` token. The UI Design Plan owns the actual values; this plan owns the convention that nothing outside `tokens.scss` should hard-code these. Component `.scss` files `@use` the tokens module for variable access; a sibling `global.scss` (imported once per sim from its entry point) is the single place that emits the runtime `:root { --foo: ... }` mirror — splitting tokens from globals prevents the `:root` block from being duplicated across separately-compiled component stylesheets in the final bundle.

### Shared controls policy

Every shared interactive control (Button, Slider, Switch, Select, Checkbox, NumberField, …) in `packages/shared/src/components/` is a **thin wrapper around a `react-aria-components` primitive**. The wrapper does three things and only three things:

1. **Applies our design tokens and SCSS** — every wrapper has a matching `.scss` file scoped under a single root class (e.g. `.button`), pulling tokens via `@use "../../styles/tokens" as tokens;`. The visual treatment lives here, not in the consumer.
2. **Wires `useLogEvent` auto-emit** — every wrapper accepts an optional `action?: string` prop and calls `logEvent(action, params)` on the relevant commit event (press for buttons, change-on-pointer-up for sliders, change for switches/selects/checkboxes). When `action` is omitted the control still works but emits nothing — useful for cosmetic controls or sub-controls inside a larger composite that emits one logical event.
3. **Forwards all other react-aria props** — wrappers do NOT recreate react-aria's prop surface. Spread the rest. Sims compose around the wrapper using react-aria's native API (`isDisabled`, `onPress`, `aria-label`, …), not a re-invented one.

Wrappers never re-export react-aria-components directly. Sims import controls only from the `@concord-consortium/mass-sims-shared` barrel; if a sim needs a primitive we haven't wrapped yet, that's a signal to add a wrapper (so the auto-emit and token application stay centralized), not to bring `react-aria-components` into the sim's dependency graph.

The first wrapper, `<Button>`, ships in Phase 2c along with `useLogEvent`; `<Slider>`, `<NumberField>`, `<Switch>`, `<Select>`, and `<Checkbox>` followed in Phase 3 (along with the hand-rolled `<LineChart>` / `<Histogram>`, which are SVG components rather than control wrappers).

### Accessibility conventions & known gaps (MAS-25 audit)

The MAS-25 ARIA audit settled a few cross-cutting conventions and recorded some deferred robustness gaps in the shared controls. Captured here so they aren't re-litigated. The full, consolidated set of accessibility conventions every sim follows lives in **[accessibility.md](./accessibility.md)** — this section keeps the infrastructure-level decisions:

- **Disabled-control policy is intentionally split.** Controls that must stay keyboard-discoverable while inert use **`aria-disabled` + a JS activation guard** (they keep their tab stop): the shared `<Button>`, the `<TrialCard>` reset, and the Bananas fungus switch. The form-input wrappers — `<Select>`, `<Slider>`, `<Switch>`, `<Checkbox>`, `<NumberField>` — keep react-aria's **native `disabled`** (dropped from the tab order). This mirrors the demo/spec and is deliberate; don't "unify" it into an inconsistency. (The parent `<Select>`'s native-disabled path is effectively unreachable anyway — locking swaps it for a static `.parent-chip`.)
- **Parent select uses the react-aria APG pattern, by design.** The parent dropdown delegates to react-aria's `Select` — a `<button aria-haspopup="listbox">` trigger plus a `role="listbox"`/`role="option"` popover with roving DOM focus — rather than the demo's hand-rolled `role="combobox"` + `aria-activedescendant`. Both are valid WAI-ARIA APG patterns ("collapsible listbox" vs "select-only combobox"); the react-aria one is battle-tested and keyboard-/SR-complete, so it's preferred. Documented at the top of [`select.tsx`](../packages/shared/src/components/select/select.tsx).
- **Deferred robustness gaps, to revisit when a consumer needs them:**
  - **Nameless-if-unnamed controls.** `<NumberField>`, `<Select>`, and `<Slider>` make their `label`/`ariaLabel` optional with **no `aria-label` fallback** — omitting it yields an unnamed control. `<LineChart>` / `<Histogram>` now degrade gracefully instead: with no `ariaLabel` they drop `role="img"` and render decorative (rather than an unlabeled image), so a nameless chart is silent to AT but not a WCAG 1.1.1 failure. Every current consumer supplies a name; consider requiring one (or falling back) when a consumer doesn't.
  - **No error/validation association exists yet.** There's no validation UI anywhere, so `aria-describedby` / `role="alert"` / `aria-invalid` wiring is N/A today. `<NumberField>` clamps `min`/`max` silently. If/when a sim adds validation, wire this up.

### What's deliberately *not* in this section

Layout details, dimensions (1044/1024/989/767 × 562), the three-column flex behavior, chrome suppression when embedded, scrolling rules, touch interaction specifics, color palette, region visual styling — all in the [UI Design Plan](./ui-design-plan.md).

---

## 4. What to clone from FOSS

Direct lifts (with light updates for modern dependencies):

- **Monorepo skeleton.** Keep Yarn workspaces + Lerna 4 verbatim from FOSS. The package layout (`common/` → `packages/shared/`, `starter/` → `packages/starter/`, sims at top level → `simulations/*`) is sound and only needs renaming.
- **Shared component anatomy.** Most components in `foss/common/src/components/controls/` (Button, PlayButton, NewRunButton, Slider, Switch, RadioButtons, Select, Checkbox, etc.) port over largely as-is. Strip out i18n calls — see §6.
- **`useModelState` + `useSimulationRunner` hook pattern.** The IModelInputState / IModelOutputState / snapshot array architecture is exactly the right abstraction for the kinds of sims described.
- **Build/deploy GitHub Actions pattern.** `ci.yml` and `release.yml` translate cleanly with the new toolchain.
- **Design tokens.** Initially seeded from FOSS's blue/orange/green/purple palette as a placeholder; superseded by the demo-derived palette (mostly grayscale + `#005FCC` focus + `#e8e8e8` panel surface; Lato + Roboto Condensed). See UI Design Plan §13 for the concrete values. The structuring convention (semantic aliases over raw values; nothing hard-coded outside `tokens.scss`) is unchanged.
- **`Dialog` with `focus-trap`** and **drag-and-drop** wrappers around `@dnd-kit`.
- **A `Table` component** if and when a sim needs tabular data. FOSS's `react-table` v7 implementation is the starting point if we revive it, though the underlying library choice (Tanstack v8 vs react-aria-components Table vs something simpler) is deliberately deferred until the first sim's needs can drive it.
- **`BarGraph` component** as a starting point for any bar visualization a future sim wants. The shared chart approach is hand-rolled (React + SCSS + SVG, no library); see §11 #19 for context.

Do **not** clone:

- The `translation/` directory or any `t()` call sites — see §6.
- `SecondGradeFrame` and `second-grade-simulation/` — different audience model; not in our requirements.
- `react-howler` audio dep — no audio/read-aloud needed.
- Any of the 11 simulation directories themselves.

---

## 5. What to backport from DESE

DESE has had two more years of development than FOSS; pick up these specific improvements:

1. **`useFrameLoop` hook.** Wraps `requestAnimationFrame` with proper cleanup and frame-time delta. Cleaner than the manual rAF in FOSS's `useSimulationRunner`. Consider merging the two.
2. **Frame-rate-aware stepping** (as seen in `dese-models/energy/src/components/app.tsx`). Targets 60 FPS but adaptively does multiple model steps per frame if the renderer falls behind. This is the kind of pattern that keeps slower student laptops smooth.
3. **`useStateWithCallback` / `useStateWithCallbackLazy`.** Useful for state changes that need to trigger follow-up logic without an extra `useEffect`.
4. **`seeded-random.ts`.** Deterministic randomness is a must-have for reproducible educational simulations (so a teacher can show the "same" simulation twice). FOSS doesn't have this.
5. **`useCurrentAndPrevious`, `useInterval`.** Small utility hooks that come up repeatedly.
6. **Asset module filenames pattern** (`[name]-[hash:8][ext][query]` in webpack). Translate to the Vite equivalent (`build.assetsInlineLimit` + `rollupOptions.output.assetFileNames`).
7. **V2 control components** (in `pci-common/src/v2/components/`) are generally better than V1 — start from those when porting controls. Compare against FOSS's equivalents and merge the best version of each.
8. **Strong TypeScript generics on hooks.** DESE's `useModelState<IInput, IOutput, ITransient>` signature is worth adopting.

Do **not** backport:

- `PersistentString` / `MirrorString` — these exist only for Pearson's TestNav read-aloud system.
- `pci-webpack-plugin` — TestNav-specific.
- `test-harness/` directory — TestNav harness.
- The TestNav-flavored APIs in `render-app.tsx` (`addExternalSetStateListener`, `logEvent`, `interactiveBridge.js` plumbing, AMD `customModule` wrapping).
- `theme-utils.ts` and the 7 contrast palettes — no custom accessibility themes, and no light/dark mode either.
- The translation system in `pci-common/src/translation/`.
- AMD module wrapping in `custom.ts` — we are a standard SPA bundle.

**However** — two architectural concepts from DESE's TestNav layer are worth keeping, rebuilt on top of CC's own libraries:

1. **State sync via `@concord-consortium/lara-interactive-api`** (replaces DESE's external state listener). Sims use lara-interactive-api's `useInitMessage` (restore on init) and `setInteractiveState` (push on change) directly — the library handles init handshakes, saved-state restore, and push-up of new state via iframe-phone, with standalone-vs-embedded detection built in. See §3 "AP state sync" for the convention.
2. **Action logging via `useLogEvent`** (replaces DESE's `logEvent` callback). A single emit point in `packages/shared/hooks/use-log-event.ts` fans out to two transports:
   - **Portal-report** via `@concord-consortium/lara-interactive-api` — fires when the sim is embedded in Activity Player (or any compatible host).
   - **Google Analytics 4** via inline `gtag.js` — fires when a repo-wide `VITE_GA_PROPERTY_ID` env var is set at build time. Empty/missing means GA is disabled.
   Both transports are independently opt-out and use the **same event vocabulary**, so a new event added to one is automatically added to the other. Continuous controls (e.g. sliders) emit a single event on commit (`pointerup`/`change`) rather than during the drag — simpler and dramatically lower volume than throttled mid-drag emission.
   Shared controls (`Button`, `Slider`, `Switch`, `Select`, `Checkbox`, etc.) call `useLogEvent` automatically on every user-initiated change, so every sim gets baseline logging "for free" without per-sim wiring. Sims can also emit custom events for sim-specific actions (e.g. `"trial_started"`, `"fungus_introduced"`).
   Event-name conventions follow GA4's stricter constraints (`snake_case`, ≤ 40 chars, ≤ 25 custom parameters, values ≤ 100 chars) so a single payload works for both endpoints without translation.

When the sim is loaded standalone (no iframe parent, no GA property ID), both transports no-op gracefully. This is also what makes the sims transferable to DESE-org hosting without code changes (see §13).

These two patterns are the only things we deliberately *bring across* from DESE's TestNav layer; everything else stays excluded.

---

## 6. Excluded features — what to actively scrub

Going through your list one by one:

- **Login/auth.** Neither repo has any; nothing to remove. Skip.
- **TestNav.** Present in DESE only. Concretely means: do not copy `test-harness/`, `pci-webpack-plugin/`, any `custom.ts` entry, any `item.xml` generation, the `interactiveBridge.js` integration, or any of the `onStateChange` / `addExternalSetStateListener` / `logEvent` plumbing in `render-app.tsx`.
- **Localization / translations.** Both repos have a lightweight custom `t()` system. We are committing to **English only**, no stub:
  - Do not copy `common/src/translation/` (FOSS) or `pci-common/src/translation/` (DESE).
  - Do not copy any per-sim `lang/` or `translation/lang/` directories.
  - Replace all `t("KEY")` call sites with plain string literals as components are ported.
  - No `t()` identity stub. If we ever need i18n later, it's a clean greenfield addition rather than half-installed scaffolding.
- **Read-aloud / TTS.** Remove `PersistentString`/`MirrorString` usage. Do not copy `react-howler`. Standard browser SR support (semantic HTML + `aria-label`s + `aria-live` where appropriate) is sufficient.
- **Custom color-blind themes.** Do not copy `theme-utils.ts` or any contrast-palette switcher. Use a single well-tested color palette that meets WCAG AA contrast and works for the three common color-vision deficiencies (i.e., avoid red/green-only encoding, use shape + label + color redundantly). This is general accessibility practice, not a custom theme system.

### Accessibility we DO keep

- Semantic HTML, ARIA attributes on controls.
- `focus-trap` in dialogs.
- Keyboard support in `@dnd-kit`.
- Biome's `a11y` rule group in lint configuration (with the caveat noted in §10 that its coverage vs. `eslint-plugin-jsx-a11y` is verified in Phase 0).
- `@axe-core/react` in development builds to surface a11y issues in the console.
- Choose color palette with deuteranopia/protanopia in mind from the start (no separate "color-blind mode" needed).

---

## 7. Dependency baseline

Target versions, current as of May 2026. Pin minor where stability matters, allow caret elsewhere.

| Package | Target | Notes |
| --- | --- | --- |
| `react`, `react-dom` | `^19.2` | Concurrent features; works with the React Compiler if we enable it |
| `typescript` | `^6.0` | Strict by default; ES2025 target |
| Node.js | `>=24` | Current LTS as of May 2026. Set in root `package.json` `engines.node` and `NODE_VERSION` in the CI workflow. (Node 20 was deprecated on GitHub runners on June 2, 2026; Node 22 entered maintenance LTS in October 2025.) |
| `vite` | `^8.0` | Build + dev. `base: "./"` is the validated publicPath pattern for versioned-folder deploys (see §8). Bumped from `^6.0` during Phase 1 to align with `@vitejs/plugin-react@^6` (which requires Vite 8). |
| `@vitejs/plugin-react` | `^6.0.2` | React support for Vite. v6 line targets Vite 8's Rolldown/OXC pipeline and avoids the deprecation warnings the v4 line emits under Vite 6+. |
| `vite-plugin-svgr` | latest | SVG-as-React-component (Vite equivalent of `@svgr/webpack`) |
| `vitest` | `^4.0` | Test runner — comes with Vite |
| `@testing-library/react` | latest | |
| `@testing-library/jest-dom` | latest | Matchers (works with Vitest via `expect.extend`) |
| `@playwright/test` | latest | E2E |
| `yarn` | `^1.22` (Classic) | Package manager; matches FOSS/DESE |
| `lerna` | `^4` | Monorepo orchestrator; matches FOSS/DESE |
| `@biomejs/biome` | `^2.4.0` | Lint + format in one tool. Pin the minor explicitly: the config schema changed between 2.0 and 2.2 (folder-ignore patterns dropped the trailing `/**`, `organizeImports` moved into `assist.actions.source`, `noConsoleLog` renamed to `noConsole`). The `$schema` URL in `biome.json` must track the installed minor or the IDE complains and the CLI may warn on schema drift. When bumping the package, update the URL in the same commit. |
| `lefthook` | latest | Git precommit/prepush hooks |
| `react-aria-components` | `^1.18` | Headless, fully-accessible UI primitives from Adobe. Every shared interactive control is a thin wrapper around a react-aria primitive that applies our tokens, SCSS, and the `useLogEvent` auto-emit. Replaces MUI as the resolved answer to the UI-library question (UI Design Plan §15 Q9, now closed). |
| ~~`@tanstack/react-table`~~ | _deferred_ | Table component deferred until a sim needs tabular data. |
| `@dnd-kit/core`, `@dnd-kit/sortable` | latest | Keyboard-accessible DnD |
| `iframe-phone` | `^1.3.1` | Concord's parent ↔ child iframe messaging (for Activity Player embed). Stable; last published 2021. |
| `@concord-consortium/lara-interactive-api` | `^1.9.4` | Portal-report-compatible state sync + action logging; uses `iframe-phone` under the hood. |
| `gtag.js` (inline, no npm dep) | from Google CDN | GA4 transport. Loaded via `<script>` in each sim's `index.html` template; property ID injected at build time from `VITE_GA_PROPERTY_ID`. |
| `focus-trap-react` | latest | Dialog focus trap |
| `clsx` | latest | Tiny class joiner |
| `sass`, `postcss`, `autoprefixer` | latest | SCSS compilation + browser prefix |
| ~~`@axe-core/react`~~ | _deferred_ | Runtime a11y checking deferred to Phase 6 hardening (Biome's a11y rules + the axe DevTools extension cover the interim). `@axe-core/react` is archived for React 18+, so the future integration uses the bare `axe-core` package. |

Removed compared to FOSS/DESE: `webpack` and all loaders, `jest` and `ts-jest`, `cypress`, `eslint` and all eslint plugins (replaced by Biome), `react-howler`, the entire translation tooling, `@material-ui/core@^4` (DESE), `@svgr/webpack` (replaced by `vite-plugin-svgr`), and any `@mui/*` (the UI library answer is `react-aria-components` — see §11 #9 closed).

**Net change count vs. FOSS:** Vite (replaces Webpack), Vitest (rides with Vite), Biome (replaces ESLint), Playwright (replaces Cypress), plus Lefthook (new addition). Yarn workspaces and Lerna are unchanged.

---

## 8. Build, dev, test, and deploy

### Local dev

```bash
yarn install                                              # installs everything (hoisted via yarn workspaces)
yarn workspace sim-one dev                                # vite dev server for one sim
yarn workspace @concord-consortium/mass-sims-shared build # rebuild shared library
yarn lerna run dev --parallel                             # all sims in parallel
```

### Scripts in each sim's `package.json`

- `dev` — `vite`
- `build` — `tsc --noEmit && vite build`
- `preview` — `vite preview`
- `test` — `vitest run`
- `test:watch` — `vitest`
- `lint` — `biome check src`
- `lint:fix` — `biome check --write src`
- `format` — `biome format --write src`

### Root-level scripts

- `build` — `lerna run build`
- `test` — `lerna run test`
- `lint` — `biome check .`
- `format` — `biome format --write .`
- `e2e` — `playwright test`
- `clean` — `lerna run clean && rimraf node_modules`

### Precommit (lefthook)

`lefthook.yml` at the repo root wires `biome check --staged` and `tsc --noEmit` into the pre-commit hook so style and type errors fail fast before they reach CI. Hooks install automatically on `yarn install` via a `postinstall` script (`lefthook install`).

### CI

GitHub Actions. We adopt the **OIDC-based deployment pattern** from [`concord-consortium/starter-projects`](https://github.com/concord-consortium/starter-projects/blob/main/doc/deploy-setup.md) rather than long-lived AWS access keys.

- `ci.yml` runs on every push: install → `biome check` → `tsc --noEmit` → unit tests (Vitest) → build (Vite) → e2e (Playwright, against built artifacts) → S3 deploy.
- S3 target: existing `models-resources` bucket, `mass-sims/` subfolder.
- Deploy paths:
  - Branch builds: `s3://models-resources/mass-sims/branch/<branch-name>/<sim-name>/`
  - Tagged releases: `s3://models-resources/mass-sims/version/<tag>/<sim-name>/`
- Each sim emits an `index.html` plus hashed assets at its sub-path. The root `index.html` at `/mass-sims/` (or `/mass-sims/version/<tag>/`) is the landing page linking to each sim. Generated by `scripts/gen-index.ts` so it stays in sync as sims are added.
- **Action versions (as of Phase 0):** `actions/checkout@v5`, `actions/setup-node@v5`, `aws-actions/configure-aws-credentials@v6.1.3`. Pin action major+minor explicitly so a GitHub-runner-side Node runtime change can't silently break the workflow. Each action's tag should target a release that supports the Node runtime currently active on the runner (Node 24 from June 2026 onward; Node 20 was deprecated then). When bumping the runner's `NODE_VERSION` env var, sanity-check that the actions still publish a tag compatible with that Node version.
- **Vite + S3 publicPath (validated, with dynamic-publicPath support added):** Vite's `base: "./"` covers the per-version case (HTML and JS co-located in `version/<tag>/<sim>/`). For the top-level *promoted* release pattern (`/mass-sims/<sim>/index.html` referencing JS still living in `/mass-sims/version/<tag>/<sim>/`), we use Vite's `experimental.renderBuiltUrl` to emit a self-contained `new URL("../" + filename, import.meta.url).href` expression for each JS-emitted asset reference — the Vite equivalent of Webpack's `publicPath: "auto"`. The full pattern is described in the "Top-level release promotion via index-top.html" subsection below.

### Top-level release promotion via `index-top.html`

The reference pattern from [`concord-consortium/starter-projects` `doc/deploy.md`](https://github.com/concord-consortium/starter-projects/blob/main/doc/deploy.md) — adapted for our multi-sim monorepo.

**The two URL shapes we support:**

| URL shape | Example | Purpose |
| --- | --- | --- |
| Per-version | `https://models-resources.concord.org/mass-sims/version/v1.2.3/sim-one/index.html` | The exact build artifact for tag `v1.2.3`. Always available, immutable. |
| Top-level (promoted) | `https://models-resources.concord.org/mass-sims/sim-one/index.html` | The currently-released version. Replaced when a new release is promoted. |

The per-version URL works trivially: HTML and JS are co-located in the same versioned folder, so `base: "./"` makes asset paths "just work."

The top-level URL is the tricky one. HTML lives at `/mass-sims/sim-one/index.html`. The JS bundle still lives at `/mass-sims/version/v1.2.3/sim-one/assets/main-abc.js` — *not* in the same folder as the HTML. The HTML's script tag points up and over (`<script src="../version/v1.2.3/sim-one/assets/main-abc.js">`), but inside the JS, asset references like `import iconUrl from "./icon.png"` would (without intervention) resolve relative to the HTML's location and 404. We need the JS to compute its asset paths relative to *itself*.

This is the same problem Webpack 5 solves with `publicPath: "auto"`. Vite doesn't have a direct equivalent but provides the building blocks:

#### The Vite-side pattern

The shared Vite config (`packages/shared/src/vite-config.ts`, consumed by every sim's `vite.config.ts`) configures `experimental.renderBuiltUrl` to emit a self-contained runtime expression for every JS-emitted asset URL:

```ts
experimental: {
  renderBuiltUrl(filename, { hostType }) {
    if (hostType === "js") {
      return {
        runtime: `new URL("../" + ${JSON.stringify(filename)}, import.meta.url).href`,
      };
    }
    return { relative: true };  // HTML and CSS stay relative
  },
},
```

`import.meta.url` resolves at runtime to the URL of the chunk that's executing. Our chunks live at `<sim>/assets/<chunk>-<hash>.js`, so going up one level (`new URL("..", import.meta.url)`) lands at the sim root. `filename` is the asset path relative to that root (e.g. `assets/test-image-abc.png`), so the full expression yields the correct absolute URL whether the HTML lives at `/mass-sims/version/v1.2.3/sim-one/` (per-version) or `/mass-sims/sim-one/` (promoted) — the JS computes asset URLs relative to *itself*, never relative to the HTML.

No setup file, no `globalThis` writes, no ordering constraint. Each module that does `import iconUrl from "./icon.png"` resolves correctly regardless of where it sits in the import graph — Rollup inlines the `import.meta.url`-based expression at the call site at build time. `main.tsx` follows the project's standard convention (external imports first, then local).

CSS-emitted asset URLs (e.g. `url(./icon.png)` inside a `.css` file) stay relative, because the browser resolves them relative to the CSS file, which always sits next to its assets.

#### The build-side pattern: `index-top.html`

Each sim's build produces two HTML files:

- **`dist/index.html`** — paths use `./assets/main-abc.js` (relative to HTML's directory). Deployed to `version/<tag>/<sim>/index.html` for per-version URLs.
- **`dist/index-top.html`** — paths rewritten to `../version/<tag>/<sim>/assets/main-abc.js`. CI uploads this alongside the versioned `index.html` (at `version/<tag>/<sim>/index-top.html`) so the Release workflow can later copy it to the top-level `<sim>/index.html` via a pure S3-to-S3 copy.

`dist/index-top.html` is generated by a small post-build script (`scripts/generate-index-top.ts`) wired in as each sim's `postbuild` npm script. The script reads `dist/index.html`, replaces `src="./...` and `href="./...` with the versioned prefix derived from `MASS_SIMS_VERSION_PATH` env var, and writes `dist/index-top.html`.

#### The CI-side deploy logic

`ci.yml` deploys both branch pushes and tag pushes to their versioned S3 paths only. Tag pushes do **not** automatically promote to the top-level URLs — promotion is a separate, deliberate action via the Release workflow (`release.yml`). So pushing a tag gets you a stable, immutable URL at `/mass-sims/version/<tag>/<sim>/` that's ready for QA; it does not change what end users see at the top-level URL until someone manually promotes it.

To support that two-step flow, the versioned deploy uploads `index-top.html` alongside `index.html` (both at `version/<tag>/<sim>/`). The bytes that ship to the top-level URL are then exactly the bytes that were tested under the versioned URL — no rebuild between QA and release.

#### The Release workflow

`release.yml` is a `workflow_dispatch`-only workflow that takes a `version` input (e.g. `v1.2.3`) and:

- Verifies that `s3://.../mass-sims/version/<version>/` exists (i.e. the tag was previously deployed by CI).
- Lists the sim subfolders under that path and, for each, copies `version/<version>/<sim>/index-top.html` → `<sim>/index.html` at the top level.
- Copies `version/<version>/index.html` → `index.html` at the top level (the landing page uses relative `./<sim>/` links, so the same file works at both URL depths).

There is no checkout and no build — the workflow is pure S3-to-S3 copy under the same OIDC role used by CI. Rollback to a prior release is the same operation pointed at the older tag.

Pre-release tags get a versioned deploy automatically (they push) but are never promoted until someone runs the Release workflow. The promote-on-every-tag risk goes away by construction.

#### Local testing: `build:top-test` and `serve:top-test`

To exercise the full pattern locally without an S3 deploy:

```sh
yarn build:top-test
yarn serve:top-test
# Visit http://localhost:8000/
```

`build:top-test` runs `scripts/build-top-test.ts`, which:

1. Builds every sim with `MASS_SIMS_VERSION_PATH=version/release`.
2. Sets up a `top-test/` directory mirroring the production S3 layout:

```
top-test/
├── index.html                ← root landing page (copied from repo's index.html)
├── sim-one/index.html        ← promoted (the index-top.html for sim-one)
├── sim-two/index.html        ← promoted
└── version/release/
    ├── sim-one/...            ← the actual bundle
    └── sim-two/...
```

`serve:top-test` runs `serve` against that directory on port 8000. Clicking through the sim links exercises the same dynamic-publicPath path the production S3 promotion uses. If asset references break, they'll break here too — visibly, locally, before a deploy.

### S3 bucket prefix and OIDC setup (one-time, Phase 0)

The `mass-sims/` prefix under the existing `models-resources` bucket doesn't exist yet, and the new repo needs an IAM role configured to deploy to it. The good news: this is largely automated by a script in `starter-projects`. The canonical reference is [`concord-consortium/starter-projects` `doc/deploy-setup.md`](https://github.com/concord-consortium/starter-projects/blob/main/doc/deploy-setup.md).

#### What's already in place (account-level, shared)

CC's AWS account already has, set up once for all CC repos:

1. **GitHub OIDC identity provider** registered as `token.actions.githubusercontent.com`. AWS STS validates GitHub's short-lived OIDC tokens against this provider, then returns temporary credentials scoped to an IAM role — no long-lived secrets needed.
2. **A shared managed policy** `S3-deploy-by-role-tag` that grants S3 access to `models-resources/${aws:PrincipalTag/RepoName}/*`. The same policy works for every repo because access is scoped by the role's `RepoName` tag — no per-repo policy edit required.

Neither of these needs to change for `mass-sims`.

#### What needs to happen for `mass-sims`

Run the per-repo setup script from `starter-projects`:

```sh
./scripts/create-deploy-role.sh mass-sims
```

The script:

- Creates an IAM role named `mass-sims` (matching the repo).
- Tags the role with `RepoName=mass-sims` — the tag the shared policy uses to scope access to the `mass-sims/` S3 prefix.
- Attaches the shared `S3-deploy-by-role-tag` managed policy.
- Sets the role's trust policy so only the `concord-consortium/mass-sims` GitHub repo can assume it (via the OIDC `sub` claim).
- Writes the new role ARN into the `.github/workflows/ci.yml` of the directory it is run in.

Anyone with the appropriate AWS access can run this — it does not require a separate ops ticket beyond confirming who has that access.

#### Operational nuance: where to run the script (Phase 0 lesson)

The script edits `.github/workflows/ci.yml` **relative to the current working directory**, not the repo whose name you pass as an argument. There are two clean workflows; pick one upfront:

1. **Scaffold mass-sims from `starter-projects` as a template.** Then run the script from inside the new `mass-sims` clone. The script modifies *your* `ci.yml` directly. Per the canonical doc, delete the `doc/deploy-setup.md` and `scripts/create-deploy-role.sh` copies that came along with the template after the script has run.
2. **Don't scaffold from `starter-projects`** (e.g. you built `mass-sims` from a different base, as we did). Then run the script from *inside* a separate `starter-projects` clone — but be aware the script will overwrite `starter-projects`' own `ci.yml`, which you'll need to revert (`git checkout -- .github/workflows/ci.yml` inside `starter-projects`). Then either paste the printed role ARN into `mass-sims/.github/workflows/ci.yml` manually, **or** (cleaner) leave the workflow referencing `${{ vars.AWS_DEPLOY_ROLE_ARN }}` and set that as a GitHub Actions repository variable on the `mass-sims` repo — Settings → Secrets and variables → Actions → Variables. The repo-variable path keeps the ARN out of source and survives future re-runs of the script cleanly.

The Phase 0 implementation took workflow 2 (the repo-variable variant). Future repos can pick either.

#### Post-script cleanup (only when scaffolded from `starter-projects`)

If `mass-sims` was scaffolded from `starter-projects` (workflow 1 above), the copies of `doc/deploy-setup.md` and `scripts/create-deploy-role.sh` that came along should be **deleted** from `mass-sims` after the script has run. The canonical versions live only in `starter-projects`; keeping copies risks drift. If you didn't scaffold from `starter-projects` (workflow 2), the script and doc never enter `mass-sims` in the first place and there's nothing to clean up.

#### What does *not* need explicit setup

- **The `mass-sims/` S3 prefix itself.** S3 prefixes are implicit; the first PutObject from the first successful deploy materializes the prefix.
- **The shared deploy policy.** Already in place and works for new repos by virtue of the tag-based scoping; no policy edit required.
- **Bucket public-read, CORS, Block Public Access.** Already configured correctly for `models-resources` since other CC projects deploy and serve from there. Worth a one-time eyeball check during Phase 0 to confirm `mass-sims/*` isn't excluded by anything narrower, but no setup work expected.

#### Validation

The first Phase 0 hello-world deploy to `s3://models-resources/mass-sims/branch/main/` is the end-to-end test of the role + policy + bucket configuration. The Vite/S3 publicPath spike piggybacks on the same deploy (same upload, more careful asset-path checks).

### CI structure at scale

Building every sim on every push works fine at 4 sims. At 20+ it becomes painful — both in wall-clock time and in noise (a typo in one sim shouldn't force a rebuild of all the others). The plan is to design the CI for scale from day one, even though it won't bite until later:

- **One workflow file per sim**, matching DESE's pattern. Each `.github/workflows/<sim-name>.yml` is triggered only by changes under `simulations/<sim-name>/**` (plus changes under `packages/shared/**` or root configs, which trigger all sims).
- The per-sim workflow files are **generated from a template** by `scripts/gen-workflows.ts` so we don't duplicate boilerplate across 20+ files. The template lives in `scripts/templates/sim-workflow.yml.tmpl`.
- A separate `commons.yml` runs on changes to `packages/shared/**` and triggers a full-fan-out rebuild of every sim.
- A separate `ci.yml` handles the cross-cutting work (lint, typecheck across the whole repo, e2e smoke tests).
- Lerna's `--since` flag (`lerna run build --since origin/main`) is the runtime fallback for selective work when path-filter triggers aren't precise enough.
- `gen-index.ts` and `gen-workflows.ts` run as part of CI in "verify" mode (fail if the generated outputs are out of sync with the workspace list) so the generated artifacts never drift.

---

## 9. Phased delivery plan

I'd suggest sequencing the work in five phases. Rough estimates assume one to two devs working part-time.

**Phase 0 — Repo bootstrap (≈ 2-3 days) — ✅ COMPLETE**
Create the `concord-consortium/mass-sims` repo. Set up the empty Yarn + Lerna monorepo (mirroring FOSS's `package.json` `workspaces` field and `lerna.json`), root configs (tsconfig.base.json, biome.json, lefthook.yml, gitignore), MIT `LICENSE` file. Run `create-deploy-role.sh` from a `starter-projects` clone — see §8 "S3 bucket prefix and OIDC setup" for the two operational workflows and which one fits your scaffolding choice. CI skeleton runs `biome check` + `tsc --noEmit` on a hello-world and deploys to `s3://models-resources/mass-sims/branch/main/`. **Vite/S3 publicPath spike — validated:** `base: "./"` produces relocatable bundles; the dynamic-publicPath complexity from FOSS's Webpack config is not needed for our case. See §8.

**Phase 1 — Shared library v0 (≈ 1-2 weeks)**
Port the smaller utility hooks and design tokens from FOSS/DESE. Build the three-region `SimulationFrame` component fresh — slot API and `<Section>` wrapper per §3, visual specifics per the [UI Design Plan](./ui-design-plan.md). Implement `useReloadWarning`. Port the FOSS palette into `tokens.scss` with token-only access (plus the global stylesheet that mirrors selected tokens as CSS custom properties). Set up Vitest + a couple of smoke tests. Confirm rendering at the four target widths × 562 px from the UI plan.

> **Status (Phase 1 build):** `Section` and the `SimulationFrame` compound component (header + Trials/Simulation/Data slots + three-column flex grid + accessible info modal) are built to the §3 API and exported from the shared barrel; the four-width × 562 render check is satisfied by the non-deployed `packages/sim-frame-preview` workspace. Utility hooks, tokens, and `global.scss` are in place. **Deferred:** final Section/chip/region visual treatment and designer-tuned slot proportions. Styling is plain (global) SCSS scoped under a per-component root class (the verified house convention — see the corrected Styling note in §1); the info-modal prop is `infoModalContent`.

**Phase 2 — Starter simulation + iframe embedding + logging + scaffolding (≈ 4-6 weeks total)**
Phase 2 was always going to be the biggest single block, so it's split into three landed-incrementally subphases.

- **Phase 2a — Shared library rebuild against the demo design (✅ COMPLETE).** Token rewrite (`tokens.scss`, `global.scss`), partner-branding SVGs, restructured `<SimulationFrame>` (50 px title bar, draggable About panel, no project bar), new `<TrialCard>` and `<DataSubsection>` components, `sim-frame-preview` workspace updated.

- **Phase 2b — Starter sim + simulation state hooks (✅ COMPLETE).** Built `packages/starter` as a real random-walk simulation; landed `useModelState<IInput, IOutput, ITransient>` and `useSimulationRunner`. Addendum (Tasks 11–15) added responsive column flex behavior + standalone outer container to `<SimulationFrame>`.

- **Phase 2c — AP embedding, action logging, react-aria foundation, scaffolding (≈ 2-3 weeks).** Wire sims to `@concord-consortium/lara-interactive-api`'s state sync (`useInitMessage` + `setInteractiveState`) directly — no custom wrapper hook in shared; the convention is documented in §3 above and shown by worked example in `docs/adding-a-new-sim.md`. Prove the round-trip with a local Activity Player smoke test. Implement `useLogEvent` with the dual-transport design (portal-report via lara-interactive-api + GA4 via inline `gtag.js`) — continuous controls emit on commit only (`pointerup`/`change`), not during drag. Inject `VITE_GA_PROPERTY_ID` into each sim's `index.html` template; verify GA is fully disabled when the env var is empty. Land the **react-aria-components foundation** (the UI primitives library, decision 9 in §11) plus the first shared control, `<Button>`, wired to auto-emit log events; migrate Starter's existing Play/Pause/Step/Reset to it. Build `scripts/new-sim.ts` and `scripts/gen-workflows.ts` along with their CI `--check` modes — these unlock easy growth toward 20+ sims and should exist before the first real sim, not after the fifth. (`scripts/gen-index.ts` already shipped in Phase 1.)

**Phase 3 — Port the remaining controls + viz components (≈ 2-3 weeks)**
With the react-aria-components pattern established in Phase 2c, mechanically port the remaining V2 controls (`Slider`, `Switch`, `Select`, `Checkbox`, `NumberField`) as thin wrappers, plus two graphing primitives (hand-rolled SVG `<LineChart>` and `<Histogram>` — no chart library, matching FOSS / DESE precedent). Each control auto-emits via `useLogEvent` per the convention established in §3. Add unit tests for each. Migrate the remaining Starter native HTML inputs (walker-count slider, step-size slider, frames-per-trial number input) to the new shared controls, and the two canvas-based charts in the Starter's data panel to the new shared chart components. Runtime accessibility checking via `axe-core` is deliberately deferred to Phase 6 hardening (Biome's a11y rule group covers the common-case static checks in this phase; the axe DevTools Chrome extension covers on-demand runtime checks during development). The `<Table>` component is deliberately deferred to a later phase — no sim currently in design needs one, and the underlying library choice (Tanstack v8 vs react-aria-components Table vs simpler) should be driven by a real sim's tabular-data needs.

**Phase 4 — First real simulation (≈ 2-4 weeks per sim, depending on complexity)**
Scaffold `simulations/bananas` from the starter. Iterate on the shared layer as gaps appear. The first real sim is where the abstractions get stress-tested; budget extra time. Specifically: settle the framework-level pattern for in-progress transient state escaping `useModelState` / `useSimulationRunner` to consumers outside the Simulation slot (live charts in the Data panel, live readouts elsewhere). The Phase 2b Starter intentionally leaves this question open — `output` is committed only at trial completion — because the first real sim's live-visualization shape is the right data point to design against. Candidate shapes include an `onTransientChange` option on `useSimulationRunner`, a pub-sub primitive, or hoisting transient state out of `<SimulationView>`.

**Phase 5 - Multi-sim test harness workspace**
Build a multi-sim test harness workspace (`packages/sim-test-harness`) that loads every sim at the four target widths via `<iframe>` cards — discovers sims the same way `gen-index` does, points at deployed branch URLs in CI or local dev URLs at the dev workstation. Complements `sim-frame-preview` (frame-only with placeholder content) by surveying real sims across widths; feeds Phase 5's visual-regression snapshots.

**Phase 6 — Hardening + documentation (≈ 1-2 weeks)**
Playwright suite covering critical paths in every sim. Lighthouse / axe audits. Final CI polish. Documentation in `packages/shared/README.md` covering the public component/hook API — important at the 4-sim starting point, essential by the time the repo crosses 10 sims. Include a `docs/adding-a-new-sim.md` that walks through `yarn new-sim` and the conventions a new sim author needs to know. Add a `docs/deployment.md` documenting how to build the static output and deploy it to an arbitrary host — written with the future DESE-org handoff in mind so we don't have to reverse-engineer it later.

---

## 10. Risks and mitigations

- **The three-region slot API may not fit every future sim.** Mitigation: design the slot API to allow a sim to opt out of a region (e.g., `<SimulationFrame.Data />` empty hides the column). Also expose a `layout` prop on the frame for escape hatches. (Visual-layout-specific risks live in the UI Design Plan.)
- **iframe-phone / lara-interactive-api state contracts can drift between Activity Player versions.** Mitigation: pin `iframe-phone` and `@concord-consortium/lara-interactive-api` versions explicitly (the latter handles the protocol details so sims work against a stable API surface), and add a Playwright test that loads a sim into a fixture Activity Player page to detect regressions.
- **Touch-target enforcement at the infrastructure level.** Mitigation: expose `--touch-target-min` as a design token in `tokens.scss` (mirrored to a CSS custom property by `global.scss`); consider a lint rule on shared controls that flags hit areas below the token. (Specific touch-target values and per-control sizing are UI Design Plan concerns.)
- **react-aria-components API drift.** Adobe ships frequent minors (1.x line is on a steady cadence). Mitigation: pin the minor (`^1.18`); audit the changelog before each minor bump; component wrappers in `packages/shared` mediate consumers from direct react-aria API, so a forced upgrade touches one component file, not every sim.
- **React Compiler interactions.** If we enable React 19's compiler, some manual `useMemo`/`useCallback` patterns inherited from DESE become noise. Mitigation: hold off on enabling the compiler until after Phase 2 stabilizes, then sweep to remove redundant memos.
- **TestNav-shaped state-sync expectations may haunt some hooks ported from DESE.** Mitigation: when porting `useModelState`, strip the external-listener API in one go and don't add it back unless a concrete reuse case appears.
- **Vite + S3 publicPath pattern is unproven at CC.** Engineer 1 flagged this. Mitigation: the Phase 0 spike proves the pattern with a hello-world before we sink Phase 1 work into it. If the pattern can't be made to work reasonably, the rollback to Webpack 5 is documented in the addendum below.
- **AWS access for running the deploy-role script.** The per-repo IAM role for `mass-sims` is created by running `create-deploy-role.sh` from `starter-projects`. That script needs AWS credentials with permission to create IAM roles and tag them. Mitigation: confirm before Phase 0 starts who has that access; if it isn't the person doing the coding work, schedule a brief sync to run the script.
- **Biome's a11y rule coverage may not match `eslint-plugin-jsx-a11y`.** Engineer 1's caveat. Mitigation: in Phase 0, run Biome's `recommended` and `a11y` rule sets against a port of FOSS's `common/src/components/controls/` and compare findings to ESLint output. If significant gaps appear (e.g. ARIA-attribute validation, role/state coupling), either supplement Biome with a single ESLint pass for jsx-a11y or roll back to ESLint per the addendum.
- **Lefthook hook installation must be reliable across dev machines.** Mitigation: install via the repo's `postinstall` script and document the fallback (`yarn lefthook install`) in `CONTRIBUTING.md`.
- **CI time and shared-library API churn as sim count grows.** With a 20+ sim target, two scale risks bite: (1) CI wall-clock time inflates if every sim is rebuilt on every push, and (2) any breaking change to `packages/shared` ripples across every sim simultaneously. Mitigations: per-sim workflow files with path-filter triggers (see §8 "CI structure at scale") for the first; treat `packages/shared`'s exported surface as a public API from day one, with deprecation rather than removal, and add visual / snapshot tests for shared components in Phase 3 for the second. Revisit Turborepo specifically as the sim count approaches 15-20 — its caching becomes a meaningful CI win at that scale even though it's overkill at 4-6.
- **Sim-list duplication.** DESE's pattern has the sim list duplicated across CI workflows, deploy scripts, and the root index page; each new sim requires updates in multiple places. Mitigation: the workspace list in root `package.json` is the single source of truth. `scripts/gen-index.ts` and `scripts/gen-workflows.ts` regenerate dependent artifacts from it, and CI verifies the generated outputs are up to date.
- **Portal-report event-shape compatibility.** We're relying on `@concord-consortium/lara-interactive-api` to produce events portal-report knows how to render. Mitigation: in Phase 2, ship the starter to a CC dev portal and verify logs appear correctly in portal-report before locking the event vocabulary. Treat the per-event payload shape as a versioned contract. **Verified in Phase 2c** (manual AP smoke test): the `useLogEvent` → `log(action, data)` calls land in portal-report's interactive-event view with the expected `{ trial }` params, and the `useInitMessage` / `setInteractiveState` round-trip restores trials + selection on reload.
- **GA4 + K-12 privacy/compliance.** Google's terms prohibit GA from being "designed to specifically target users under 13," and GA4's default settings can create COPPA/FERPA exposure with minor users. Mitigation: before enabling GA in any production deploy, verify with CC's privacy/legal owner (a) that IP anonymization is on, (b) that Google Signals and advertising features are disabled at the property level, and (c) the policy on standalone classroom deploys. Document the resolved policy in `docs/analytics.md`. The plan defaults to GA being **off** in any environment where the env var isn't explicitly set.
- **GA4 event-name constraints.** GA4 enforces `snake_case`, ≤ 40 char names, ≤ 25 custom params, ≤ 100 char values; some event names are reserved. Mitigation: enforce these constraints at the `useLogEvent` boundary (validate in dev mode, fail loudly), so portal-report-compatible names are also GA-compatible. Document the convention in `docs/logging.md`.
- **DESE-org transferability lag.** We're designing for transfer without knowing the target. Mitigation: see §13 — the design constraint is fully captured even though the delivery isn't. If concrete DESE constraints surface later, they should be checked against §13's checklist; deltas become discrete tasks.

---

## 11. Resolved decisions

A decision log. Items numbered here so the gaps reflect what's been delegated to the UI Design Plan or what was resolved elsewhere — not arbitrary omissions. Infrastructure-affecting decisions stay reflected in the plan body above; UI-only decisions live in the UI Design Plan.

### Project identity and ops

1. **Project name and GitHub repo location** → `concord-consortium/mass-sims`.
2. **Deployment target** → `mass-sims/` subfolder under the existing `models-resources` S3 bucket, deployed via GitHub Actions using OIDC per the [`starter-projects` pattern](https://github.com/concord-consortium/starter-projects/blob/main/doc/deploy-setup.md).
3. **License** → MIT (matches FOSS).
4. **Authors / credits / institutional branding** → minimal: a single info modal per sim containing general sim info plus licensing/author credit.

### Tech stack

5. **Build tool** → Vite 6+. (Already in production at CC; biggest dev-velocity win.) Phase 0 spike validated: `base: "./"` produces relocatable bundles; FOSS's Webpack dynamic-publicPath complexity is not needed for our case.
6. **Package manager + monorepo orchestrator** → Stay on **Yarn 1.x workspaces + Lerna 4**, unchanged from FOSS. Avoids adding pnpm as a third package manager and avoids a simultaneous Turborepo migration. Given the 20+ sim growth expectation, Turborepo is a likely future addition (it layers on top of yarn workspaces without disruption) — but the right time to introduce it is when CI cache misses are actually costing minutes, not now.
7. **React version** → React 19.2.
8. **TypeScript version** → TypeScript 6.x.
9. **UI component library** → **`react-aria-components`** (Adobe). Headless, fully-accessible primitives; each shared interactive control in `packages/shared` is a thin wrapper around a react-aria primitive that applies our tokens, our SCSS, and the `useLogEvent` auto-emit. MUI is not used. Rationale: headless primitives let us match the demo-derived visual design without fighting a theme system, and Adobe's accessibility testing is deep. UI Design Plan §15 Q9 closed by this decision.
10. **Unit-test framework** → Vitest. (Comes essentially free with Vite; running Jest with Vite is more work.)
11. **E2E framework** → Playwright.
22. **Storybook** → No (FOSS does not use it; following that pattern).

#### Additional tooling decisions

- **Lint + format** → Biome (replaces ESLint; adds formatting we didn't have). Already in production at CC.
- **Git precommit hooks** → Lefthook. Already a CC standard in newer repos. Net-new (no precommit hooks in either reference repo).
- **Yarn version** → Yarn 1.x Classic (matches FOSS/DESE). Yarn 4 has more rigorous dependency hygiene but is a larger migration; not worth it inside the change budget.

### UI and product

12-18, 14a. *UI / visual design decisions (simulation region layout, data panel position, trials list behavior, section title chips, run-history persistence, default color palette, light/dark mode, devices and viewport) → moved to [UI Design Plan §14](./ui-design-plan.md). The contract-level requirements they imply on the shared library (`<SimulationFrame>` slots, `<Section>` component, `useReloadWarning` hook, `tokens.scss` / `global.scss` token system) are captured in §3 of this plan.*

19. **Charting library** → **None — hand-rolled SVG.** Shared `<LineChart>` and `<Histogram>` in `packages/shared` are React + SCSS + SVG components (no library), matching FOSS / DESE precedent (both hand-roll their visualizations). `<Histogram>` auto-bins raw `number[]` values (via internal `histogramBins` / `niceStep` helpers); `<LineChart>` plots single-series `(x, y)` data. Token-driven theming via CSS classes on the SVG primitives; full control over a11y and bundle weight. Other chart types (categorical bar, scatter, area, multi-series + legend) are deferred until a sim needs them, and the library question gets revisited only if a sim needs interactive tooltips / animation / brushing that would be too costly to hand-roll. Closes UI Design Plan §15 Q19.

20-21. *Shared-library scope decisions (simulation rendering layer, `<RunsTable>`/`<BarGraph>` location) → tracked in [UI Design Plan §15](./ui-design-plan.md).*

### Future extensibility

23. **Localization stub** → No stub. Fully English-only.
24. **Embedding** → Yes. Sims must work as iframe interactives inside [Activity Player](https://github.com/concord-consortium/activity-player) via `iframe-phone`, as well as standalone.
25. **Versioning** → Single fixed monorepo version.
26. **Telemetry / analytics** → Resolved by decisions 27–28 below: action logging via `@concord-consortium/lara-interactive-api` to portal-report, plus GA4 as a parallel transport.
27. **Action logging** → Dual transport. Portal-report via `@concord-consortium/lara-interactive-api`; GA4 via inline `gtag.js`. Single emit point at `packages/shared/src/hooks/use-log-event.ts`. Both transports no-op independently when not configured.
28. **Log granularity** → Every user-initiated input change is logged. Shared controls wire in automatically. **Continuous controls (sliders) emit a single event on commit (`pointerup`/`change`), not during drag** — simpler, dramatically lower volume, and arguably more meaningful. Sims may emit custom domain-specific events on top.
29. **GA scope** → Fires in both embedded and standalone contexts. Portal-report tracks individual learner actions (teacher view); GA tracks overall sim usage (CC ops/product view). Different consumers, both useful.
30. **GA property ID** → Single repo-wide `VITE_GA_PROPERTY_ID` env var. Empty / missing disables GA entirely. Per-sim breakdowns happen inside GA via a `sim_name` custom event parameter, not via separate property IDs.
31. **GA library choice** → Inline `gtag.js` injected into each sim's `index.html` template. No React wrapper (no `react-ga4` dependency) — keeps the bundle smaller and the integration transparent.
32. **Event-name convention** → GA4's stricter constraints (`snake_case`, ≤ 40 chars, ≤ 25 custom params, values ≤ 100 chars). Enforced at the `useLogEvent` boundary in dev mode. Same payload works for both transports.
33. **Transferability to DESE-org hosting** → A design constraint, not yet a delivery. We don't know yet whether the handoff will be source, built files, or both; no specific infrastructure constraints have been provided. The plan addresses portability generically — see §13. Revisit when concrete requirements arrive.

---

## 12. Open questions (still pending)

There are currently no infrastructure-level open questions. Phase 0 can start when the team is ready.

UI-flavored open questions (Q9 UI component library, Q19 graphing library, Q20 rendering layer, Q21 `<RunsTable>`/`<BarGraph>` scope) live in the [UI Design Plan §15](./ui-design-plan.md) and do not gate Phase 0. Phase 1 needs UI plan input on those items before its visual work can complete, but the contract in §3 is enough to start scaffolding the shared library.

---

## 13. Transferability as a design constraint

We may eventually need to hand the simulations (code, built artifacts, or both) over to the contracting DESE-org for hosting on their own servers. We don't yet know the scope of the transfer or any specific infrastructure constraints. This section consolidates the decisions throughout the plan that keep that option open, so they don't drift apart over time.

### What's already covered

1. **Fully static build output.** Vite produces HTML + JS + CSS + assets; no server-side code, no runtime dependencies on CC infrastructure. Built sims can be served from any static host (S3, Cloudflare Pages, GitHub Pages, a plain Apache/Nginx, etc.) without modification.
2. **Relative asset paths.** The Phase 0 Vite/S3 publicPath spike establishes that built bundles load their assets relative to the JS bundle, not from a hard-coded absolute URL. A built sim can be relocated to a new host and path without rebuilding.
3. **Opt-out AP state sync.** lara-interactive-api's hooks detect whether a compatible parent is present and no-op cleanly when standalone: `useInitMessage()` stays `null` and `setInteractiveState()` is a no-op. DESE hosting without Activity Player works without code changes.
4. **Opt-out portal-report logging.** `useLogEvent`'s portal-report transport (via `@concord-consortium/lara-interactive-api`) no-ops when there's no compatible parent. If DESE wants its own per-learner reporting, the hook is the natural seam to redirect events to a different endpoint.
5. **Opt-out GA.** `useLogEvent`'s GA transport is disabled whenever `VITE_GA_PROPERTY_ID` is empty at build time. For a DESE-hosted build, the natural handoff is to either leave the env var unset (no GA) or substitute DESE's own GA4 property ID. Either way, no code changes required.
6. **MIT license.** No legal encumbrance on transfer.
7. **Public npm dependencies only.** Everything in the dep tree is publicly resolvable. No CC-private packages, no GitHub-Packages-only releases. (Including `@concord-consortium/*` — those are public npm packages.)
8. **No hard-coded CC URLs.** Any service endpoint that we expect to vary (logging endpoint, asset CDN, etc.) is read from env vars at build time or from the iframe-phone init payload at runtime. We do not bake `concord.org` URLs into source.
9. **`docs/deployment.md`** (Phase 5 deliverable) covers building and deploying to an arbitrary static host, written with a DESE-led handover in mind.

### What we're deliberately *not* doing yet

- **Not** stripping CC branding from the source (the credits/info modal still says "Concord Consortium"). A future DESE handover would substitute via a config switch, not a fork.
- **Deferred but planned: a context-injected log service.** `useLogEvent` currently calls the portal-report + GA transports directly. We plan to refactor it to resolve a *log service* from a top-level React context, making the dual-transport logger one swappable implementation set by the app. This formalizes the §13.4 seam — giving a DESE deployment a clean place to plug in alternative analytics — and lets tests inject a mock service via a provider instead of mocking the `lara-interactive-api` module. Chosen shape: keep `useLogEvent`'s signature (it reads the service from context and still returns a `logEvent` fn), so call sites and `<Button>` are unaffected and no caller churns. **Not part of the initial logging work**; no hard deadline — do it as a cleanup, and it becomes a prerequisite once a second log implementation (e.g. DESE analytics) is actually needed.
- **Not** building a `.tar.gz` export script for handoff. We'll write one if/when the transfer scope is clear.

### To revisit when DESE transfer requirements are known

- Source-only handoff vs. built-files handoff vs. both — affects what docs and packaging are needed.
- Whether DESE will continue to use Activity Player as a host (in which case nothing changes) or run sims standalone or in their own host (in which case the iframe-phone and logging no-op paths get real-world testing).
- Whether DESE needs the build to target a specific URL/path structure.
- Whether portal-report logging should stop, redirect, or continue on DESE-hosted instances.
- Any accessibility/compliance requirements beyond what the plan already covers.

---

*End of main plan. The infrastructure decisions are settled enough for Phase 0 to start. The companion [UI Design Plan](./ui-design-plan.md) continues to iterate independently — Phase 1's `SimulationFrame` work needs design input on the resolved/open items there, but the API contract in §3 is stable. See §13 above for transferability constraints and Addendum A below for documented rollback paths on the tooling changes.*

---

## Addendum A — Rollback paths for tooling decisions

The tooling decisions in this plan (Vite, Vitest, Biome, Lefthook, Playwright) introduce small but real risks. This addendum documents, for each change, how we'd back out if the tool turns out to be a poor fit — and the day-one habits that keep the rollback cheap.

The general principle: **isolate tool-specific touchpoints behind thin abstractions so rollback is config-level work, not code-rewrite work.**

### A.1 Vite → Webpack 5

**Rollback target:** Webpack 5, configured the way FOSS does it (`foss/common/webpack-common.config.js` plus a per-sim `webpack.config.js`).

**Likelihood:** Low-to-moderate. The S3 publicPath spike in Phase 0 is the gate — if the spike succeeds we're committed; if it fails this is the most likely rollback.

**Lock-in surface (avoid these to keep rollback cheap):**
- `import.meta.env.*` — the plan recommended centralizing all access in a single `packages/shared/src/utils/env.ts`. **This was not adopted** — no `env.ts` was created and the few `import.meta.env` reads sit inline, so on rollback they (not one file) are the find-replace surface: convert them to `process.env.*` reads behind a `DefinePlugin`. Still a small surface today, but worth centralizing before it grows if rollback likelihood rises.
- `import.meta.glob` — **do not use.** Use static imports. If a dynamic-import pattern is needed, use the ES standard `import()` which both bundlers support.
- `import.meta.hot` (HMR API) — only use if necessary; both bundlers expose HMR but with different APIs.
- Vite plugins without a clear Webpack equivalent — prefer well-known plugins (`vite-plugin-svgr`, `vite-plugin-checker`) over exotic ones.
- SVG imports use Vite's `?react` query suffix (e.g., `import Icon from "./icon.svg?react"`). The Webpack/SVGR equivalent is a plain `import { ReactComponent as Icon } from "./icon.svg"`. **Mitigation:** define a single SVG import convention in `packages/shared/README.md` and apply it consistently; the rollback is then a project-wide find-replace.
- Asset URL suffixes (`?url`, `?raw`) — use sparingly; Webpack equivalents exist but require asset-module config tweaks.

**Files affected by a rollback:**
- Each `vite.config.ts` → `webpack.config.js` (and a `webpack-common.config.js` extracted to `packages/shared/`).
- Each sim's `index.html` (Vite's bare `<script type="module" src="/src/index.tsx">` → Webpack pattern with `HtmlWebpackPlugin` injection).
- All SVG import statements (find-replace `.svg?react` → `.svg` plus the named-export change).
- The inline `import.meta.env.*` reads (converted to `process.env.*` behind a `DefinePlugin`; the proposed `env.ts` centralization was never adopted, so these are scattered rather than in one file).
- `package.json` scripts in every package (`vite` → `webpack serve`, `vite build` → `webpack --mode production`).
- `vitest.config.ts` (covered separately in A.2; the two roll back together cleanly).

**Effort estimate:** ~1 week for the first package (recreate the config from FOSS's pattern); ~1 day per subsequent package once the pattern is established. Roughly 2-3 weeks total for a six-package monorepo.

**Rollback playbook:**
1. Copy FOSS's `common/webpack-common.config.js` into `packages/shared/` as the starting point.
2. Convert one sim's `vite.config.ts` to `webpack.config.js` extending the shared common config.
3. Replace SVG imports project-wide via codemod.
4. Convert the inline `import.meta.env.*` reads to `process.env` (behind `DefinePlugin`).
5. Add `webpack`, `webpack-cli`, `webpack-dev-server`, `ts-loader`, `babel-loader`, `css-loader`, `sass-loader`, `style-loader`, `html-webpack-plugin`, `@svgr/webpack`, `copy-webpack-plugin` to devDependencies.
6. Roll back Vitest in the same change (see A.2).
7. Update CI: `vite build` → `webpack --mode production`.

### A.2 Vitest → Jest

**Rollback target:** Jest (the version FOSS uses, ~27, or current stable 30).

**Likelihood:** Bundled with Vite rollback. Vitest by itself is unlikely to be the problem — its API is close enough to Jest that the swap is mostly mechanical.

**Lock-in surface (avoid these):**
- `import.meta.vitest` (in-source tests) — **do not use.** Keep tests in dedicated `*.test.ts(x)` files alongside the source file.
- Vitest's UI mode (`vitest --ui`) — fine for local dev, but never write tests that depend on the UI being present.
- Vitest-only matchers or snapshot serializers — stick to `@testing-library/jest-dom` matchers (which work in both runners) and default snapshot serialization.
- **Always import test functions explicitly** from `"vitest"` (e.g., `import { describe, it, expect, vi } from "vitest"`) rather than relying on globals. Explicit imports make a rollback find-replace trivial; globals leave the test files apparently free-floating.

**Files affected by a rollback:**
- Every `*.test.ts(x)` file's import statement.
- Each `vitest.config.ts` → `jest.config.js` (or `jest.config.ts`).
- `package.json` scripts (`vitest` → `jest`).
- `setupTests.ts` files may need minor tweaks.

**Effort estimate:** ~half a day per package, ~2-3 days total.

**Rollback playbook:**
1. Install `jest`, `ts-jest`, `jest-environment-jsdom`, `@testing-library/jest-dom`, `@types/jest`.
2. Convert `vitest.config.ts` → `jest.config.js` (Jest's config is similar; the transform pipeline is the main difference — `vite` plugins out, `ts-jest` in).
3. Codemod each test file: `import { describe, it, expect, vi } from "vitest"` → `import { describe, it, expect, jest } from "@jest/globals"`, then find-replace `vi.fn` → `jest.fn`, `vi.mock` → `jest.mock`, `vi.spyOn` → `jest.spyOn`.
4. Update `package.json` scripts.

### A.3 Biome → ESLint + Prettier

**Rollback target:** ESLint 9+ (with `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`) plus Prettier.

**Likelihood:** Low-to-moderate. The known risk is jsx-a11y coverage — verified in Phase 0.

**Lock-in surface (essentially none for code; configuration only):**
- Biome's rule set differs from ESLint's, but the underlying *code* doesn't change. A rollback affects config files, not source files.
- **Patterns to follow NOW:**
  - Stick to Biome's `recommended` and `a11y` rule groups. Avoid leaning on Biome-exclusive rules with no clear ESLint equivalent.
  - Keep a `docs/eslint-rollback.cjs` file checked in — an annotated ESLint config that maps each enabled Biome rule to the closest ESLint equivalent. Treat it as living documentation; update it whenever the Biome config is touched.
  - Don't use Biome's import sorter as the *source of truth* for import order; if used, accept that a one-off reorder happens on rollback.

**Files affected by a rollback:**
- `biome.json` removed.
- Added: `.eslintrc.cjs` (at root, possibly per-package overrides), `.prettierrc.json`, `.eslintignore`, `.prettierignore`.
- `package.json` scripts (`biome check` → `eslint . && prettier --check .`).
- `lefthook.yml` (the precommit step swaps Biome's command for ESLint+Prettier — see A.4).
- Source code does *not* change, though one-off `eslint --fix && prettier --write` may flag and auto-correct minor differences.

**Effort estimate:** ~1 day total. Mostly config setup plus running `--fix`/`--write` once to align.

**Rollback playbook:**
1. Promote `docs/eslint-rollback.cjs` to `.eslintrc.cjs`.
2. Add a `.prettierrc.json` (start from CC's `accessibility-tools` repo if it predates Biome there).
3. `yarn add -D -W eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y prettier`.
4. Update `package.json` scripts and `lefthook.yml`.
5. Run `yarn lint --fix && yarn format` once to auto-correct any divergent formatting.
6. Remove `biome.json` and `@biomejs/biome` from devDependencies.

### A.4 Lefthook → Husky (or no precommit hooks)

**Rollback target:** Husky, or simply removing precommit hooks entirely.

**Likelihood:** Very low. Lefthook is small, declarative, and has no real lock-in.

**Lock-in surface:** essentially none.

**Files affected by a rollback:**
- `lefthook.yml` deleted.
- `package.json` `postinstall` script: remove `lefthook install`.
- Added (if going to Husky): `.husky/pre-commit` script, `husky` dev dependency.

**Effort estimate:** ~30 minutes.

**Rollback playbook:**
1. `yarn remove -W lefthook`.
2. Delete `lefthook.yml` and the `postinstall` lefthook line.
3. (Optional) `yarn add -D -W husky lint-staged` and create `.husky/pre-commit` running the same commands.

### A.5 Playwright → Cypress

**Rollback target:** Cypress 13+, as used by FOSS.

**Likelihood:** Very low. Playwright is a cross-org commitment at CC; rolling back here would mean reversing a broader institutional decision.

**Lock-in surface:** Higher than the others. Playwright and Cypress have fundamentally different APIs (Playwright uses async/await, Cypress uses chained commands and an internal queue). Tests are not portable via find-replace.

**Patterns to follow NOW to keep what little portability is achievable:**
- Use Playwright's `expect()` (web-first assertions) over raw `page.locator(...).innerText()` checks. Cypress has similar `cy.get(...).should("contain", ...)` assertions, so a one-to-one mental mapping exists.
- Centralize selectors in a `tests-e2e/selectors.ts` file rather than hard-coding them inline. Easier to port the test logic to a new runner if needed.
- Use `data-testid` attributes for test selectors rather than CSS classes or text content; same convention works in either runner.

**Files affected by a rollback:**
- All files under `tests-e2e/` rewritten test-by-test.
- `playwright.config.ts` → `cypress.config.ts`.
- `package.json` scripts.
- GitHub Actions e2e job.

**Effort estimate:** ~1-2 days per sim's e2e suite. The largest of the rollbacks if it ever happens.

**Rollback playbook:** I won't write this one in detail — it's a major undertaking and would be a project of its own. Document it if and only if the institutional decision reverses.

### A.6 Summary — rollback effort matrix

| From | To | Likelihood | Effort | Lock-in concentration |
| --- | --- | --- | --- | --- |
| Vite | Webpack 5 | Low-moderate | ~2-3 weeks total | `vite.config.ts`, env access, SVG import syntax |
| Vitest | Jest | Bundled with Vite rollback | ~2-3 days total | Test file imports (mechanical) |
| Biome | ESLint + Prettier | Low-moderate | ~1 day total | Config files only — *no source-code changes* |
| Lefthook | Husky or none | Very low | ~30 minutes | None |
| Playwright | Cypress | Very low (cross-org commitment) | ~1-2 days *per sim* | High — APIs differ fundamentally |

The first four are configuration-level rollbacks. Playwright is the only one with deep code lock-in, and it's also the least likely to be rolled back.

### A.7 Day-one habits checklist

To keep rollbacks cheap, the team should adopt these conventions from Phase 0:

1. Centralize `import.meta.env` access in a single `packages/shared/src/utils/env.ts`. *(Not adopted — the surface stayed small enough that the reads were left inline; revisit if it grows.)*
2. Never use `import.meta.glob` or `import.meta.vitest`.
3. Always import test functions explicitly from `"vitest"`.
4. Document the SVG import convention in `packages/shared/README.md`.
5. Maintain `docs/eslint-rollback.cjs` as a living, annotated mirror of `biome.json`.
6. Use `data-testid` attributes for e2e selectors, centralized in `tests-e2e/selectors.ts`.
7. Avoid any tool's exotic / experimental features unless the equivalent exists in the rollback target.
