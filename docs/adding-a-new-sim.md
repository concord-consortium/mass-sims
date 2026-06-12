# Adding a new simulation

This is the step-by-step for scaffolding a new Mass Sims simulation from the Starter
template. The Starter is a working random-walk sim wired with everything a new sim needs:
the `<SimulationFrame>` layout, the shared `<Button>`, action logging via `useLogEvent`,
and Activity Player saved-state sync. You replace the model and the panels; the
infrastructure comes for free.

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

## 4. Replace the model

The random-walk model lives in `src/model/`:

- `types.ts` — `SimInput` (user-controlled parameters), `SimOutput` (per-trial recorded
  result), `SimTransient` (per-frame state), and `RecordedTrial` (one trial's input +
  output + final snapshot).
- `random-walk.ts` — the step function and trial finalization.

Replace these with your own model's types and stepping logic, then update
`src/components/simulation-view.tsx` (the runner + canvas/visualization) and
`src/components/data-panel.tsx` (the recorded-results view) to match. The shared hooks
`useModelState` and `useSimulationRunner` (from `@concord-consortium/mass-sims-shared`)
handle the input/output/transient state split and the play/pause/step loop — keep using
them.

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
hook (see [infrastructure-plan.md §3 "AP state sync"](./infrastructure-plan.md)). The
pattern is two independent effects: restore on init, push on change. Define the persisted
shape, then wire it in `app.tsx`:

```tsx
// src/model/saved-state.ts
import type { RecordedTrial } from "./types";

// Only plain JSON-serializable values. Per-frame transient state (live positions, frame
// counter) is intentionally NOT persisted — students restart trials on return.
export interface SavedState {
  trials: RecordedTrial[];
  selectedId: string;
}
```

```tsx
// app.tsx
import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { useEffect } from "react";
import type { SavedState } from "./model/saved-state";

const initMsg = useInitMessage<SavedState>();
// Embedded once the AP handshake delivers an init message; null in standalone.
const isEmbedded = initMsg !== null;

// Restore on init. `"interactiveState" in initMsg` narrows the discriminated union to the
// runtime/report variants; the truthy check skips the first-session null.
useEffect(() => {
  if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
    setState(initMsg.interactiveState);
  }
}, [initMsg]);

// Push on every trial-list / selection change (user actions, not per-frame — low rate).
useEffect(() => {
  setInteractiveState<SavedState>({ trials, selectedId });
}, [trials, selectedId]);

// Warn before unload ONLY in standalone — when embedded, AP persists every change, so
// the data isn't at risk on reload and the prompt would fire during AP's own navigation.
useReloadWarning(!isEmbedded && trials.some((t) => t.output !== null));
```

The library handles standalone-vs-embedded internally: outside AP, `useInitMessage()`
stays `null` and `setInteractiveState()` is a no-op, so no `inIframe()` guards are needed.
The Starter keeps its trial list in its own React state and pushes via `setInteractiveState`
rather than using lara-interactive-api's combined `useInteractiveState` hook, because that
composes more cleanly with the existing trial-list state.

> **Chrome when embedded.** `<SimulationFrame>` accepts `standalone?: boolean` to toggle
> its outer container (defaults to `true`, overridable via a `?standalone=false` URL
> param). If your host should supply the surrounding chrome, derive it from the embed
> flag: `<SimulationFrame standalone={!isEmbedded} …>`.

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

## 8. Deploy

Deployment is automatic via the generated `sim-<name>.yml` workflow:

- **Push to a branch** → builds and deploys to
  `…/mass-sims/branch/<branch>/<name>/index.html`.
- **Push a tag (`v*`)** → deploys to `…/mass-sims/version/<tag>/<name>/`; promote to the
  top-level URL with the **Release** workflow (Actions → Release → Run workflow).

The per-sim workflow's path filters trigger it only when the sim's own directory,
`packages/shared/**`, or its workflow file changes.

## Quick checklist

- [ ] `yarn new-sim <name>` then `yarn install`
- [ ] `yarn gen-index && yarn gen-workflows`, commit the regenerated output
- [ ] Set `simTitle` / `tagline` / About content in `app.tsx`
- [ ] Replace `src/model/` and the two panel components with your model
- [ ] Define `SavedState` and wire the restore/push effects + standalone-gated reload warning
- [ ] Give interactive controls snake_case `action` names
- [ ] `yarn workspace <name> typecheck && yarn workspace <name> test && yarn workspace <name> build`
