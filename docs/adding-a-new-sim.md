# Adding a new simulation

This is the step-by-step for scaffolding a new Mass Sims simulation from the Starter
template. The Starter is a working random-walk sim wired with everything a new sim needs:
the `<SimulationFrame>` layout, **MST state management** (a `RootStore` built on the shared
trial-list infrastructure), the shared `<Button>`, action logging via `useLogEvent`, and
Activity Player saved-state sync. You replace the model, the stores' per-trial shape, and the
panels; the infrastructure comes for free.

For the full shared-library API surface, see [infrastructure-plan.md §3](./infrastructure-plan.md).

## 1. Scaffold

```bash
yarn new-sim <name>
```

`<name>` is kebab-case (lowercase, digits, hyphens; starting with a letter) and becomes
both the directory name (`simulations/<name>/`) and the package name. Reserved names
(`shared`, `starter`, `sim-frame-preview`, `mass-sims`) are rejected, and the script
refuses to overwrite an existing directory.

This copies `packages/starter/` into `simulations/<name>/`, rewrites the `package.json`
name, and replaces the `simTitle` in `app.tsx` with a `<NEW SIM TITLE>` placeholder.

## 2. Link the workspace and refresh derived artifacts

```bash
yarn install            # link the new workspace (the root `simulations/*` glob picks it up)
yarn gen-index          # refresh the root index.html that lists every sim
yarn gen-workflows      # generate .github/workflows/sim-<name>.yml (per-sim build + deploy)
```

`gen-index` and `gen-workflows` both have a `--check` mode that CI runs on every push, so
commit their regenerated output alongside your new sim — a stale index or missing workflow
fails CI.

## 3. Fill in the sim's identity

In `simulations/<name>/src/app.tsx`, set the `<SimulationFrame>` props:

```tsx
<SimulationFrame
  simTitle="Photosynthesis"            // replaces the "<NEW SIM TITLE>" placeholder
  tagline="Watch a leaf convert light to sugar"
  infoModalContent={<p>One or two sentences for the About panel…</p>}
>
```

## 4. Replace the model and stores

**Model** (`src/model/`):

- `types.ts` — `SimInput` (user-controlled parameters), `SimOutput` (per-trial recorded
  result), `SimTransient` (per-frame state), and `RecordedTrial` (one trial's recorded data:
  input + output + final snapshot; mirrors the MST `TrialModel`'s snapshot).
- `random-walk.ts` — the step function and trial finalization.

**Stores** (`src/stores/`) — the trial list is managed with **MST** (mobx-state-tree). The
universal trial-list infrastructure lives in `@concord-consortium/mass-sims-shared`
(`packages/shared/src/trials/`): the `TRIAL_LETTERS_DEFAULT` / `MAX_TRIALS_DEFAULT` constants, a
`UiStore` base (holds the active trial letter), the multi-trial logic (`activeTrial`, `canAddTrial`,
`trialLetters`, `hasAnyProgress`, `addTrial`), and the saved-state envelope helper. Each sim
provides:

- `stores/trial-model.ts` — your sim's `TrialModel` (its `input` / `output` / `finalTransient`
  shapes are sim-specific). A trial's identity is its letter (the map key) — there is no `id`.
- `stores/root-store.ts` — a `RootStore` holding `trials: types.map(TrialModel)` + `ui: UiStore`,
  which consumes the shared multi-trial helpers and exposes `createRootStore({ rng })`,
  `RootStoreProvider`, and `useStores`. Write your own `resetTrial` here (its cleanup side-effects
  are sim-specific). The `rng` is injected via the MST environment so tests pass a seeded PRNG.

Copy Starter's `stores/` as your template. Components that read store state are wrapped in `observer`
and call `useStores()`. If your sim needs UI state beyond the active trial letter, compose your own
UiStore on top of the shared base via `types.compose` (Bananas's per-trial cross selection is the
reference).

Replace the model types and stepping logic, then update `src/components/simulation-view.tsx` (the
runner + canvas/visualization) and `src/components/data-panel.tsx` (the recorded-results view) to
match. The shared hooks `useModelState` and `useSimulationRunner` handle the running trial's
per-frame state and the play/pause/step loop — these **stay** alongside MST: MST owns the trial LIST
(what trials exist, which is selected, each trial's recorded result); `useModelState` owns the
per-frame transient state of the trial currently running.

**Trials column.** `src/components/trials-panel/` renders the trial selector as a single-select
`role="listbox"` of `role="option"` cards with roving-tabindex keyboard nav, plus a `+ New` card and
a max-trials notice as siblings *outside* the listbox (a listbox must not own focusable non-options)
— see [docs/playwright.md](./playwright.md). Reuse Starter's `<TrialsPanel>` as the reference and
swap in your sim's per-card body and enriched aria-label.

For parameter inputs and data visualization, use the **shared controls and charts** from
`@concord-consortium/mass-sims-shared` rather than native HTML elements — the Starter's
`simulation-view.tsx` already demonstrates one of each control (`<Slider>`, `<NumberField>`,
`<Switch>`, `<Select>`, `<Checkbox>`) and `data-panel.tsx` uses the shared `<LineChart>` and
`<Histogram>`. They apply the design tokens, are fully accessible (react-aria under the hood),
and **auto-emit a log event when given an `action="…"` prop** (snake_case). See
[infrastructure-plan.md §3](./infrastructure-plan.md) for the component catalog and the
"Shared controls policy."

## 5. Wire Activity Player saved state

Sims import lara-interactive-api's state-sync API **directly** — there is no shared wrapper
hook (see [infrastructure-plan.md §3 "AP state sync"](./infrastructure-plan.md)). The persisted
shape is a **flat versioned envelope** — `{ version, trials, selectedTrialLetter }` — projected from
the MST snapshot via the shared envelope helper. Define it in `stores/saved-state.ts`:

```tsx
// src/stores/saved-state.ts
import { type TrialLetter, toVersionedSavedState } from "@concord-consortium/mass-sims-shared";
import type { RootStoreSnapshotOut } from "./root-store";
import type { TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

// Only plain JSON-serializable values; transient UI state is left out. Per-frame transient state
// (live positions, frame counter) is also NOT persisted — students restart trials on return.
export interface SavedState {
  version: typeof SAVED_STATE_VERSION;
  trials: Partial<Record<TrialLetter, TrialState>>;
  selectedTrialLetter: TrialLetter;
}

export function toSavedState(snap: RootStoreSnapshotOut): SavedState {
  return toVersionedSavedState(SAVED_STATE_VERSION, snap) as SavedState;
}

// Validate a restored state into the current shape, or null if unrecognized. The `version` field is
// the forward-migration hook for any future shape change.
export function migrateSavedState(raw: unknown): SavedState | null {
  /* …validate version + trials + selectedTrialLetter… */
}
```

Then wire two effects in `app.tsx` — restore on init, push on change:

```tsx
// app.tsx
import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { applySnapshot, getSnapshot, onSnapshot } from "mobx-state-tree";
import { useEffect } from "react";
import type { RootStoreSnapshotOut } from "./stores/root-store";
import { migrateSavedState, type SavedState, toSavedState } from "./stores/saved-state";

const initMsg = useInitMessage<SavedState>();
const isEmbedded = initMsg !== null; // embedded once the AP handshake delivers an init message

// Hydrate: migrate the wire format, then project it into the MST snapshot shape and apply. NOTE the
// explicit { trials, ui: {...} } construction — the wire format is NOT the store snapshot.
useEffect(() => {
  if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
    const state = migrateSavedState(initMsg.interactiveState);
    if (state) {
      applySnapshot(rootStore, {
        trials: state.trials,
        ui: { selectedTrialLetter: state.selectedTrialLetter },
      });
    }
  }
}, [initMsg, rootStore]);

// Persist via onSnapshot (fires on the snapshot-emit boundary), with an initial save on mount and a
// serialized-payload dedup so identical payloads aren't re-emitted.
useEffect(() => {
  let lastSaved = "";
  const save = (snap: RootStoreSnapshotOut) => {
    const state = toSavedState(snap);
    const serialized = JSON.stringify(state);
    if (serialized === lastSaved) return;
    lastSaved = serialized;
    setInteractiveState<SavedState>(state);
  };
  save(getSnapshot(rootStore));
  return onSnapshot(rootStore, save);
}, [rootStore]);

// Warn before unload ONLY in standalone — when embedded, AP persists every change, so the data isn't
// at risk on reload and the prompt would fire during AP's own navigation.
useReloadWarning(!isEmbedded && rootStore.hasAnyProgress);
```

The library handles standalone-vs-embedded internally: outside AP, `useInitMessage()` stays `null`
and `setInteractiveState()` is a no-op, so no `inIframe()` guards are needed. The Starter pushes via
`setInteractiveState` rather than lara-interactive-api's combined `useInteractiveState` hook because
that composes more cleanly with the MST snapshot flow.

> **Chrome when embedded.** `<SimulationFrame>` toggles its outer container via
> `standalone?: boolean`, and the starter template already wires it to embed detection —
> `<SimulationFrame standalone={!isEmbedded} …>` — so an embedded sim suppresses its own
> container and lets AP supply the chrome with no author action needed. Precedence is
> `?standalone=` URL param → prop → `true` default: the param is the highest, so appending
> `?standalone=false` forces AP-style chrome for testing/preview without editing the sim,
> even though the sim always passes the prop.

## 6. Logging conventions

The shared `<Button>` auto-emits a log event when given an `action` prop; call `useLogEvent`
directly for sim-specific events. Event names must be **snake_case, ≤ 40 chars**, with
**≤ 25 params** whose string values are **≤ 100 chars** (GA4's constraints — `useLogEvent`
validates and throws in dev). Examples: `play_pressed`, `trial_started`,
`fungus_introduced`.

```tsx
<Button action="trial_started" actionParams={{ trial: trialLabel }} onPress={play}>
  Play
</Button>
```

## 7. Assets

Put sim-specific images / SVGs in `src/assets/` and import them so Vite fingerprints them
into `dist/assets/`. Shared partner-branding SVGs already live in the shared library; don't
duplicate them.

For a monochrome icon you want to theme, import the SVG with the `?react` suffix
(`import Icon from "./icon.svg?react"`) so it renders as a component; give the asset
`fill="currentColor"` and it takes its color from CSS `color`. See
[`packages/shared/README.md`](../packages/shared/README.md) for the full SVG import convention.

## 8. Deploy

Deployment is automatic via the generated `sim-<name>.yml` workflow:

- **Push to a branch** → builds and deploys to
  `…/mass-sims/branch/<branch>/<name>/index.html`.
- **Push a tag (`v*`)** → deploys to `…/mass-sims/version/<tag>/<name>/`; promote to the
  top-level URL with the **Release** workflow (Actions → Release → Run workflow).

The per-sim workflow's path filters trigger it only when the sim's own directory,
`packages/shared/**`, or its workflow file changes.

## 9. End-to-end tests

`yarn new-sim` already scaffolded your sim's Playwright coverage: a smoke spec
(`playwright/tests/smoke/<name>.test.ts`), a page object (`playwright/pages/<name>-page.ts`), and a
`playwright/sims.ts` registry entry. The smoke spec is copied from Starter's — it's the canonical
template — so it starts green against the freshly scaffolded sim and is meant to be **edited as you
build**:

- Update the `"<NEW SIM TITLE>"` title assertion to your real title.
- Replace the Starter-specific locators/actions in the page object with your sim's controls; the
  shared chrome (header, About modal, three slots) is inherited and usually needs no changes.
- Run it with `yarn test:playwright:build playwright/tests/smoke/<name>.test.ts` (use `:build` —
  a brand-new sim has no `dist/` until it's built).

See [`docs/playwright.md`](./playwright.md) for the full conventions (page-object pattern, the
test-data re-export convention, the four-width matrix, the build contract, the reload-warning
pattern, and how CI runs the suite).

## Quick checklist

- [ ] `yarn new-sim <name>` then `yarn install`
- [ ] `yarn gen-index && yarn gen-workflows`, commit the regenerated output
- [ ] Set `simTitle` / `tagline` / About content in `app.tsx`
- [ ] Replace `src/model/` + `src/stores/trial-model.ts` (your `TrialModel`) and the panel components
- [ ] Define the versioned `SavedState` and wire the hydrate (`applySnapshot`) / persist (`onSnapshot`) effects + standalone-gated reload warning (`hasAnyProgress`)
- [ ] Give interactive controls snake_case `action` names
- [ ] `yarn workspace <name> typecheck && yarn workspace <name> test && yarn workspace <name> build`
- [ ] Update the scaffolded smoke spec's title assertion + page-object locators; run `yarn test:playwright:build playwright/tests/smoke/<name>.test.ts` (see [`docs/playwright.md`](./playwright.md))
