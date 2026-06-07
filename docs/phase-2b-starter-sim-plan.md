# Phase 2b — Starter Sim and Simulation State Hooks

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the **Starter sim** — a real, minimal simulation that exercises every piece of the Phase 2a shared library end-to-end (SimulationFrame, TrialCard, DataSubsection, About panel, tokens) and acts as the template `yarn new-sim` will copy in Phase 2c. Along the way, ship the two simulation-state hooks the infrastructure plan §3 calls for: `useModelState<IInput, IOutput, ITransient>` and `useSimulationRunner`. Wire `useReloadWarning` into the Starter so reload protection kicks in once trials exist.

**Architecture:** The Starter sim is structured as a `<SimulationFrame>` with all three slots populated by sim-specific content. Trial cards in the Trials slot are managed by a sim-level trial-list state. The Simulation slot renders a canvas-based view driven by `useSimulationRunner` (which composes `useFrameLoop`). The Data slot renders two `<DataSubsection>` children showing aggregated outputs. Sim state is split across three React useState calls under the umbrella of `useModelState<IInput, IOutput, ITransient>` — `IInput` is what the user controls between trials (parameters), `IOutput` is what gets recorded into the trial when a run finishes, `ITransient` is the per-frame model state that updates every animation frame.

**Tech Stack:** React 19.2, TypeScript 6, Vite 8, Vitest 4 + @testing-library/react (jsdom), plain (global) SCSS via side-effect imports scoped under a root class, `clsx` for class composition, Biome (lint/format). Canvas 2D for the sim's visualization (no charting library — raw imperative drawing keeps the starter free of opinionated rendering dependencies).

---

## Conventions discovered in the codebase (follow these exactly)

These were verified by reading the existing code. Honoring them keeps the diff idiomatic.

- **Tests import from `"vitest"` explicitly** — `globals: false` is set in every `vitest.config.ts`. Never rely on injected globals.
- **`@testing-library/jest-dom` is wired** via per-workspace `test-setup.ts` files referenced from `vitest.config.ts` `setupFiles`. Component tests use `toBeInTheDocument()` / `toHaveAttribute()` / `toHaveClass()` directly.
- **`@testing-library/user-event` is NOT installed.** Use `fireEvent` for clicks and keyboard.
- **Hook tests use `@testing-library/react`'s `renderHook` + `act`** — see the existing hook tests in `packages/shared/src/hooks/*.test.ts` (`use-frame-loop.test.ts`, `use-interval.test.ts`, etc.) for the established style.
- **Component styles are plain (global) SCSS imported for side-effect** — `import "./bouncer.scss";`, NOT `import styles from "./bouncer.module.scss"`. JSX uses plain string class names composed with `clsx`. Scope every component's rules under a single root class. Do NOT use `*.module.scss`.
- **Tokens accessed via `@use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens`** — Starter is an external consumer of the shared library, so it goes through the package's `./styles/tokens` subpath export rather than a relative path.
- **The shared barrel** `@concord-consortium/mass-sims-shared` already exports `SimulationFrame`, `Section`, `TrialCard`, `DataSubsection`, `useFrameLoop`, `useReloadWarning`, `useInterval`, `useCurrentAndPrevious`, `useStateWithCallback*`, the seeded-random utility, and types. Tasks 1–2 add `useModelState` and `useSimulationRunner`.
- **SVG assets** live in each package's `src/assets/` folder (subfolders for grouping). The Starter sim can ship its own SVGs there if it needs any.
- **The `global.scss` runtime mirror** must be imported exactly once per sim from `main.tsx`. The Starter's `main.tsx` will do this.
- **Biome formatting:** double quotes, semicolons, trailing commas "all", 2-space indent, 100-char lines, `always` arrow parens. Run `yarn lint:fix` before staging if unsure.

---

## The Starter sim subject: random walk

**The Starter sim is a random-walk model:** a small population of dots starts at the canvas center; on each animation frame, each dot takes a random step (Gaussian-ish jitter). The user controls **step size**, **walker count**, and the **frame count per trial**. When a trial completes (frame count reached), the sim records the trial's aggregated outputs — average distance from origin, standard deviation of final positions — and adds the trial to the Trials column. Up to 10 trials (A–J, matching `<TrialCard>`'s cap).

Why random-walk is a good fit for the Starter:

- Pure model — no physics integration, no equations to debug.
- Visually engaging — animated dots are immediately legible.
- Trivially deterministic with a seed (uses `seededRandom` from the shared library — exercises that utility).
- Clean separation between IInput (parameters), IOutput (per-trial aggregates), and ITransient (current dot positions + frame counter).
- Naturally exercises every shared-library shape: SimulationFrame, both Section + TrialCard + DataSubsection, useFrameLoop (via useSimulationRunner), useReloadWarning.
- Educational concepts (probability, sampling, variance) line up with Mass Sims' likely audience.
- Fully generic and unencumbered — random walk is a 120-year-old concept in probability theory; no patents, copyrights, or trademarks apply.

---

## Scope guardrails (what this plan deliberately does NOT do)

Per the agreed Phase 2 split ("starter sim + model hooks in Phase 2b; iframe-phone / logging / scaffolding in Phase 2c"):

- **No iframe-phone embedding.** The Starter renders standalone. Activity Player wiring is Phase 2c.
- **No dual-transport `useLogEvent` (lara-interactive-api + GA4).** Action logging is Phase 2c.
- **No `yarn new-sim` scaffolding script.** The Starter is the template, but the script that copies it lives in Phase 2c.
- **No per-sim CI workflow generation.** The Starter doesn't need its own deploy; it's a template, not a deployable sim.
- **No charting library.** The Data panel's plots are raw Canvas 2D — choosing Recharts / Visx / D3 (Q19) is open, and locking it in via the Starter would be premature.
- **No Section notched-chip visual treatment.** Still deferred from Phase 2a; tokens exist but the SCSS layout work is pending. The Starter renders against the simplified flat-header Section.
- **No narrow-mode (676 px) layout.** Still designer-pending (Q30). The Starter wide-mode layout is the only thing that has to look right.
- **No multiple sims.** Just the Starter. `sim-one` and `sim-two` continue as the placeholder deploy-verification sims; nothing in this branch touches them beyond confirming they still build.

---

## Deviations from plan (as implemented)

These were discovered during execution and resolved with the user's sign-off. Each affected
task's body has been updated to match; this log is the at-a-glance summary.

- **Task 2 — runner test fake-timer setup.** The plan's `use-simulation-runner.test.ts` stubbed
  `requestAnimationFrame`/`cancelAnimationFrame` on top of `vi.useFakeTimers()`. Because fake
  timers already fake rAF, `useFrameLoop`'s cleanup cleared a `setTimeout`-created timer with the
  native fake `cancelAnimationFrame`, throwing and failing 2/6 tests. Resolved by dropping the
  manual stubbing and using plain `vi.useFakeTimers()` / `vi.useRealTimers()` — the exact idiom of
  the existing, passing `use-frame-loop.test.ts`. Hook code and all assertions unchanged. 6/6 pass.

- **Task 3 — jest-dom wiring.** The starter package never had `@testing-library/jest-dom`, but the
  plan's starter tests use its matchers. Added the devDep + `src/test-setup.ts` + `vitest.config.ts`
  `setupFiles`, mirroring `sim-frame-preview`, then `yarn install`. See the note in Task 3.

- **Task 4 + Tasks 5/6 — determinism (Option C).** `seededRandom(key)` returns a module-cached
  *stateful* PRNG, so the plan's "deterministic across runs with the same seed" test failed
  (re-running an identical trial continued the sequence instead of restarting). Combined with Task 5
  hardcoding one constant seed, a naively-deterministic model would also make every trial identical.
  Resolved with **Option C**: (a) `stepWalkers` now calls `resetSeededRandom(key)` before
  `seededRandom(key)` so a given `(seed, frame)` always reproduces its draws (genuinely
  deterministic; test passes verbatim), and (b) each trial is handed a **fresh seed** on Reset (Task
  5's `makeSeed()`), so trials still vary in the app. The plan's stated "trivially deterministic with
  a seed" intent is preserved.

- **Task 5 — canvas sizing (square 320 → full-width × 250).** With the canvas at 320px the
  simulation view (~500px) overflowed the Simulation slot's usable height, and the slot's
  `overflow: hidden` clipped the Play/Step/Reset buttons. The shared frame's fixed 562px height
  and non-scrolling Simulation slot are deliberate Phase 2a design, so the fix is starter-side.
  Final treatment (after visual review): the canvas is **full column width × 250px tall**. Width is
  measured responsively with a `ResizeObserver` (guarded for jsdom) so the backing store matches the
  laid-out width and the drawing stays crisp as the `minmax(0, 1fr)` Simulation column flexes; the
  draw centers on both axes since width ≠ height. 250px keeps the controls + buttons + readout
  visible without scrolling while filling the otherwise-empty vertical space a 200px square left.

- **Tasks 5 & 6 — active-trial model (replaces append-on-completion).** The plan's original Task 6
  started with an empty trial list and *appended* a new card on every completion, with `onReset`
  *deleting* the trial. That contradicts the design intent (ui-design-plan.md §14 / resolved #24/#360):
  trials are **reset, not deleted**, "each trial-card click restores that trial's state," and the sim
  always shows an active trial. Reworked to a persistent active-trial model after visual review of the
  Bananas reference:
  - **App owns the trials** (`RecordedTrial[]` with `output`/`finalTransient` now **nullable** — `null`
    = empty/unrun) + a `selectedId`. It loads with one empty, selected trial **A** plus a sim-owned
    dashed **"New"** card (the shared `TrialCard` has no add variant). "New" appends an empty trial
    (capped at J) and selects it.
  - **`SimulationView` is now trial-driven** (props `{ trial, onInputChange, onComplete, onReset }`,
    no longer `onTrialComplete`). App re-keys it per `id`+completion so it re-initializes from the
    selected trial on every select / reset / completion — **restoring the final-frame snapshot** for a
    completed trial (full restore) and frame 0 for an empty one. It still uses `useModelState` for the
    live run.
  - **Running fills the selected trial** (no append). **Play is disabled once complete** (derived from
    `frame >= framesPerTrial`) — re-running requires **Reset**, which clears the trial back to empty
    **keeping its seed** (so re-runs reproduce: deterministic, per Option C). Each trial keeps its own
    fixed seed for life; only *new* trials get a fresh seed.
  - `RecordedTrial` in `model/types.ts` gained `finalTransient` and made `output` nullable.
  - A **trial-letter badge** (the selected trial's letter, A/B/…) renders in the Simulation region's
    upper-left, matching the selected `TrialCard` badge styling (ui-design-plan.md §13 #137). It's
    sim-owned content passed as `trialLabel` and is `aria-hidden` (the selected card carries the
    authoritative state for assistive tech).

- **Shared `Section` — notched floating chip (scope add, user-requested).** The plan deliberately
  deferred the Section's notched-chip treatment (scope guardrail; Phase 2a leftover), rendering
  against a flat header. After visual review the user opted to implement it now. It edits the
  **shared library** (affects all sims + `sim-frame-preview`), so it's beyond the original "don't
  touch shared beyond the hooks" scope:
  - `section.scss` — the title chip is now a centered, surface-filled, bordered pill straddling the
    panel's top border. It stays in flex flow with a negative top margin so content clears it; the
    margin is `calc((chip-height + 2px) / -2)` so the chip centers on the 2px border. Title is Lato
    18px bold, instruction 16px regular, separated by a CSS `•` bullet (`.instruction::before`).
  - `simulation-frame.scss` — the grid `gap` was split into `column-gap` (10px, unchanged) and
    `row-gap: 20px` so the chips (upper half pokes ~18px up) sit just clear of the title bar.
  - `simulation-view.tsx`/`.scss` (starter) — canvas trimmed 250 → **240px** so the controls still
    fit the slightly shorter Simulation slot (fixed 562px frame).
  - The **trial badge** moved to the panel's top-left corner (4px inset), anchored to the enclosing
    `.section` so it escapes the slot's `overflow: hidden`.
  - Section tests are structural/accessibility-only, so they're unaffected; shared + preview + starter
    all green.

- **Incidental Biome auto-format.** A handful of files copied verbatim from the plan triggered
  Biome's formatter (single-line interfaces expanded, multi-line imports collapsed, barrel exports
  reordered, JSX text reflowed). These are cosmetic and applied via `biome check --write`, exactly
  the formatter the Conventions section already mandates; not separately tracked per task.

---

## Task 0: Confirm branch + green baseline

**Files:** none (git + verification only).

**Step 1: Confirm the branch**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
git branch --show-current
```

Expected: a fresh Phase 2b branch (e.g. `phase-2b-starter-sim`) branched off `phase-2a-shared-rebuild` (or `main` if Phase 2a has merged by then).

**Step 2: Confirm baseline is green BEFORE any changes**

```bash
yarn typecheck && yarn lint && yarn test
```

Expected: all pass. If anything fails here, STOP and report — pre-existing failure.

---

## Task 1: `useModelState<IInput, IOutput, ITransient>` hook (TDD)

The model-state hook from infrastructure-plan.md §3. Three typed state shapes — input (user-controlled parameters), output (per-trial accumulated record), transient (per-frame model state) — managed under one hook so sim authors have a single, opinionated place to keep their model.

**Files:**
- Create: `packages/shared/src/hooks/use-model-state.ts`
- Create: `packages/shared/src/hooks/use-model-state.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/shared/src/hooks/use-model-state.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModelState } from "./use-model-state";

interface Input { gravity: number; bounciness: number }
interface Output { peakHeight: number; bouncesCounted: number }
interface Transient { y: number; vy: number }

const initial = {
  initialInput: { gravity: 9.8, bounciness: 0.8 } satisfies Input,
  initialOutput: { peakHeight: 0, bouncesCounted: 0 } satisfies Output,
  initialTransient: { y: 100, vy: 0 } satisfies Transient,
};

describe("useModelState", () => {
  it("returns the three initial state shapes", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    expect(result.current.input).toEqual(initial.initialInput);
    expect(result.current.output).toEqual(initial.initialOutput);
    expect(result.current.transient).toEqual(initial.initialTransient);
  });

  it("updates input via setInput and exposes the new value", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setInput({ gravity: 1.6, bounciness: 0.5 }));
    expect(result.current.input).toEqual({ gravity: 1.6, bounciness: 0.5 });
  });

  it("supports partial input updates via setInput's function form", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setInput((prev) => ({ ...prev, gravity: 3.7 })));
    expect(result.current.input).toEqual({ gravity: 3.7, bounciness: 0.8 });
  });

  it("updates transient via setTransient (same semantics)", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setTransient({ y: 50, vy: -10 }));
    expect(result.current.transient).toEqual({ y: 50, vy: -10 });
    act(() => result.current.setTransient((prev) => ({ ...prev, y: prev.y - 5 })));
    expect(result.current.transient).toEqual({ y: 45, vy: -10 });
  });

  it("commits per-trial output via setOutput", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setOutput({ peakHeight: 120, bouncesCounted: 3 }));
    expect(result.current.output).toEqual({ peakHeight: 120, bouncesCounted: 3 });
  });

  it("resetTransient restores ONLY transient to its initial value (input and output untouched)", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => {
      result.current.setInput({ gravity: 1.6, bounciness: 0.5 });
      result.current.setTransient({ y: 0, vy: 0 });
      result.current.setOutput({ peakHeight: 50, bouncesCounted: 2 });
    });
    act(() => result.current.resetTransient());
    expect(result.current.transient).toEqual(initial.initialTransient);
    expect(result.current.input).toEqual({ gravity: 1.6, bounciness: 0.5 });
    expect(result.current.output).toEqual({ peakHeight: 50, bouncesCounted: 2 });
  });

  it("resetOutput restores ONLY output to its initial value", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => {
      result.current.setInput({ gravity: 1.6, bounciness: 0.5 });
      result.current.setOutput({ peakHeight: 80, bouncesCounted: 4 });
    });
    act(() => result.current.resetOutput());
    expect(result.current.output).toEqual(initial.initialOutput);
    expect(result.current.input).toEqual({ gravity: 1.6, bounciness: 0.5 });
  });

  it("resetAll restores all three states to their initial values", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => {
      result.current.setInput({ gravity: 1.6, bounciness: 0.5 });
      result.current.setTransient({ y: 0, vy: 0 });
      result.current.setOutput({ peakHeight: 80, bouncesCounted: 4 });
    });
    act(() => result.current.resetAll());
    expect(result.current.input).toEqual(initial.initialInput);
    expect(result.current.transient).toEqual(initial.initialTransient);
    expect(result.current.output).toEqual(initial.initialOutput);
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test use-model-state` — expect FAIL (module not found).

**Step 2: Write the hook**

Create `packages/shared/src/hooks/use-model-state.ts`:

```ts
import { type Dispatch, type SetStateAction, useCallback, useState } from "react";

export interface UseModelStateOptions<IInput, IOutput, ITransient> {
  initialInput: IInput;
  initialOutput: IOutput;
  initialTransient: ITransient;
}

export interface UseModelStateReturn<IInput, IOutput, ITransient> {
  /** User-controlled parameters (slider values, dropdown selections, etc.). */
  input: IInput;
  /** Per-trial accumulated record (computed snapshots, summary stats, etc.). */
  output: IOutput;
  /** Per-frame model state (positions, velocities, current readings). */
  transient: ITransient;
  setInput: Dispatch<SetStateAction<IInput>>;
  setOutput: Dispatch<SetStateAction<IOutput>>;
  setTransient: Dispatch<SetStateAction<ITransient>>;
  /** Restore ONLY transient to its initial value — use between trials. */
  resetTransient: () => void;
  /** Restore ONLY output to its initial value — use between trials. */
  resetOutput: () => void;
  /** Restore all three to their initial values — use on full sim reset. */
  resetAll: () => void;
}

/**
 * The canonical state hook for a Mass Sims simulation. Three typed state shapes:
 *
 *   - `input` — user-controlled parameters (what the user is setting between trials).
 *   - `output` — per-trial accumulated record (what the model produced, displayed in
 *     the Data panel and recorded into trials).
 *   - `transient` — per-frame model state (positions, velocities, current readings).
 *
 * Sims pass an initial value for each. Setters follow standard `useState` semantics
 * (value-or-updater). Three reset helpers cover the common transition points:
 * `resetTransient` between trials, `resetOutput` to clear accumulated stats, `resetAll`
 * on full sim reset.
 *
 * See docs/infrastructure-plan.md §3 for the contract. Phase 2b ships this minimal
 * shape; trial-list management lives in the sim until a follow-up hook proves useful.
 */
export function useModelState<IInput, IOutput, ITransient>(
  options: UseModelStateOptions<IInput, IOutput, ITransient>,
): UseModelStateReturn<IInput, IOutput, ITransient> {
  const { initialInput, initialOutput, initialTransient } = options;
  const [input, setInput] = useState<IInput>(initialInput);
  const [output, setOutput] = useState<IOutput>(initialOutput);
  const [transient, setTransient] = useState<ITransient>(initialTransient);
  const resetTransient = useCallback(() => setTransient(initialTransient), [initialTransient]);
  const resetOutput = useCallback(() => setOutput(initialOutput), [initialOutput]);
  const resetAll = useCallback(() => {
    setInput(initialInput);
    setOutput(initialOutput);
    setTransient(initialTransient);
  }, [initialInput, initialOutput, initialTransient]);
  return {
    input,
    output,
    transient,
    setInput,
    setOutput,
    setTransient,
    resetTransient,
    resetOutput,
    resetAll,
  };
}
```

**Step 3: Export from the barrel**

In `packages/shared/src/index.ts`, add:

```ts
export {
  useModelState,
  type UseModelStateOptions,
  type UseModelStateReturn,
} from "./hooks/use-model-state";
```

**Step 4: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test use-model-state
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
```

Expected: all 8 tests pass.

**Step 5: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): add useModelState hook (input / output / transient)`

(Suggested files to stage when the user is ready: `packages/shared/src/hooks/use-model-state.ts`, `packages/shared/src/hooks/use-model-state.test.ts`, `packages/shared/src/index.ts`.)

---

## Task 2: `useSimulationRunner` hook (TDD)

The play/pause/step lifecycle for a simulation, composing `useFrameLoop` (already shipped in Phase 1). Sims pass an `onStep` callback that receives the frame delta and advances the model.

**Files:**
- Create: `packages/shared/src/hooks/use-simulation-runner.ts`
- Create: `packages/shared/src/hooks/use-simulation-runner.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/shared/src/hooks/use-simulation-runner.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSimulationRunner } from "./use-simulation-runner";

describe("useSimulationRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback): number => {
        return setTimeout(() => cb(performance.now()), 16) as unknown as number;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts in the paused state (isPlaying = false)", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    expect(result.current.isPlaying).toBe(false);
  });

  it("play() flips isPlaying to true and triggers onStep on subsequent frames", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => {
      vi.advanceTimersByTime(50); // multiple rAF ticks
    });
    expect(onStep).toHaveBeenCalled();
  });

  it("pause() flips isPlaying to false and stops onStep calls", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const beforePauseCallCount = onStep.mock.calls.length;
    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onStep.mock.calls.length).toBe(beforePauseCallCount);
  });

  it("step() invokes onStep exactly once with a synthetic delta and leaves isPlaying false", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.step());
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep.mock.calls[0][0]).toBeTypeOf("number");
    expect(result.current.isPlaying).toBe(false);
  });

  it("step() can be called repeatedly without entering the playing state", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => {
      result.current.step();
      result.current.step();
      result.current.step();
    });
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(result.current.isPlaying).toBe(false);
  });

  it("calling play() while already playing is a no-op", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test use-simulation-runner` — expect FAIL.

**Step 2: Write the hook**

Create `packages/shared/src/hooks/use-simulation-runner.ts`:

```ts
import { useCallback, useState } from "react";
import { useFrameLoop } from "./use-frame-loop";

export interface UseSimulationRunnerOptions {
  /**
   * Called on every animation frame while running, AND once per `step()` invocation.
   * Receives the time delta in milliseconds since the previous frame (0 for step calls
   * unless the caller asks for a synthetic delta — see `stepDeltaMs`).
   */
  onStep: (deltaMs: number) => void;
  /** Synthetic delta used when `step()` is invoked. Defaults to 16 ms (~60 fps frame). */
  stepDeltaMs?: number;
}

export interface UseSimulationRunnerReturn {
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  step: () => void;
}

/**
 * Play / pause / step lifecycle on top of `useFrameLoop`. Sims pass an `onStep` callback
 * that advances the model. `play()` starts the rAF loop; `pause()` stops it; `step()`
 * invokes the callback once without changing the running state (useful for advancing the
 * model frame by frame while paused).
 *
 * See docs/infrastructure-plan.md §3 for the contract.
 */
export function useSimulationRunner({
  onStep,
  stepDeltaMs = 16,
}: UseSimulationRunnerOptions): UseSimulationRunnerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  useFrameLoop(onStep, isPlaying);
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const step = useCallback(() => {
    onStep(stepDeltaMs);
  }, [onStep, stepDeltaMs]);
  return { isPlaying, play, pause, step };
}
```

**Step 3: Export from the barrel**

In `packages/shared/src/index.ts`, add:

```ts
export {
  useSimulationRunner,
  type UseSimulationRunnerOptions,
  type UseSimulationRunnerReturn,
} from "./hooks/use-simulation-runner";
```

**Step 4: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test use-simulation-runner
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
```

Expected: all 6 tests pass.

**Step 5: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): add useSimulationRunner hook (play / pause / step)`

(Suggested files to stage when the user is ready: `packages/shared/src/hooks/use-simulation-runner.ts`, `packages/shared/src/hooks/use-simulation-runner.test.ts`, `packages/shared/src/index.ts`.)

---

## Task 3: Starter sim — package foundation

Make `packages/starter` into a real sim shell. The Phase 0 hello-world `app.tsx` and `app.test.tsx` get replaced; `main.tsx` learns to import the shared global stylesheet; the package gets a tiny model-state TypeScript module the next tasks fill in.

**Files:**
- Replace: `packages/starter/src/app.tsx` (new shell composing SimulationFrame)
- Modify: `packages/starter/src/main.tsx` (import shared global stylesheet)
- Replace: `packages/starter/src/app.test.tsx` (smoke test for the new shell)
- Create: `packages/starter/src/model/types.ts` (IInput / IOutput / ITransient definitions)
- Create: `packages/starter/src/app.scss` (sim-level styles — minimal at this stage)
- Modify: `packages/starter/package.json` (add `@testing-library/jest-dom` devDep — see note below)
- Create: `packages/starter/src/test-setup.ts` (jest-dom matchers + `afterEach(cleanup)`)
- Modify: `packages/starter/vitest.config.ts` (add `setupFiles: ["./src/test-setup.ts"]`)

> **jest-dom wiring (deviation from the original plan).** The starter package shipped its
> Phase 0 hello-world test using `container.textContent`, so it never had
> `@testing-library/jest-dom` wired. Every starter test in this plan (Tasks 3, 5, 6, 8) uses
> jest-dom matchers (`toBeInTheDocument()`, `not.toBeDisabled()`, …), so the wiring is added
> here, mirroring `packages/sim-frame-preview` exactly: add the `@testing-library/jest-dom@^6.9.1`
> devDep, create `src/test-setup.ts` (which imports `@testing-library/jest-dom/vitest` and
> registers `afterEach(cleanup)` — required because `globals: false` disables Testing Library's
> automatic cleanup), reference it from `vitest.config.ts` `setupFiles`, then run `yarn install`.
> Because `src/test-setup.ts` is in the tsconfig `include`, it also supplies the matcher type
> augmentation so the matchers typecheck.

**Step 1: Update `main.tsx` to import the shared global stylesheet**

Open `packages/starter/src/main.tsx`. Add the import at the top (matching how `sim-frame-preview` does it):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@concord-consortium/mass-sims-shared/styles/global.scss";
import { App } from "./app";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Could not find #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 2: Create `src/model/types.ts`**

This is the contract the rest of the sim's model code follows. Phase 2b's random-walk model fills in the bodies in Task 4; this task just defines the shapes.

```ts
/** Walker — a single dot in the random-walk simulation. */
export interface Walker {
  x: number;
  y: number;
}

/** Inputs the user controls between trials. */
export interface SimInput {
  /** Number of walkers (1–500). */
  walkerCount: number;
  /** Per-frame step size in pixels (0.1–5). */
  stepSize: number;
  /** Total frames per trial (50–500). */
  framesPerTrial: number;
  /** Seed for the seeded-random PRNG — same seed → same trial. */
  seed: string;
}

/** Per-trial recorded output. */
export interface SimOutput {
  /** Average distance from origin across all walkers at trial end. */
  avgDistance: number;
  /** Standard deviation of distances across walkers at trial end. */
  stdDevDistance: number;
  /** A sampled time series of avg distance (one sample per 10 frames) for the chart. */
  avgDistanceSeries: number[];
}

/** Per-frame model state. */
export interface SimTransient {
  /** Current frame within the active trial (0 ≤ frame < framesPerTrial). */
  frame: number;
  /** Current positions of all walkers. */
  walkers: Walker[];
  /** Running avg-distance series being accumulated; copied into output at trial end. */
  avgDistanceSeries: number[];
}

/** A trial that has finished recording. */
export interface RecordedTrial {
  /** Stable id (random; not the letter). */
  id: string;
  /** The inputs used for this trial — snapshotted at the moment the trial started. */
  input: SimInput;
  /** The outputs the trial produced. */
  output: SimOutput;
}
```

**Step 3: Replace `app.tsx` with the foundation shell**

Create `packages/starter/src/app.tsx`:

```tsx
import { SimulationFrame } from "@concord-consortium/mass-sims-shared";
import "./app.scss";

/**
 * Starter simulation — a random-walk model used as the template for new sims. The shell
 * composes <SimulationFrame> with placeholder slot content; later tasks fill in the real
 * trial list (Task 6), simulation view (Task 5), and data panel (Task 7).
 *
 * See docs/phase-2b-starter-sim-plan.md for the full structure.
 */
export function App() {
  return (
    <SimulationFrame
      simTitle="Random Walk"
      tagline="An interactive starter simulation"
      infoModalContent={
        <p>
          This is the Mass Sims starter simulation — a small random-walk model that serves
          as the template for new sims. Adjust the parameters, run trials, and observe how
          the population disperses over time.
        </p>
      }
    >
      <SimulationFrame.Trials>
        {/* Task 6 wires real TrialCards here. */}
      </SimulationFrame.Trials>
      <SimulationFrame.Simulation instruction="Choose parameters, then press Play">
        {/* Task 5 wires the canvas-based view here. */}
        <div className="placeholder">Simulation view (Task 5)</div>
      </SimulationFrame.Simulation>
      <SimulationFrame.Data>
        {/* Task 7 wires the DataSubsections here. */}
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
```

**Step 4: Create `app.scss` with minimal placeholder rules**

```scss
@use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens;

.placeholder {
  align-items: center;
  color: tokens.$color-text-muted;
  display: flex;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-base;
  height: 100%;
  justify-content: center;
}
```

**Step 5: Replace `app.test.tsx` with a smoke test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app";

describe("Starter App", () => {
  it("renders the SimulationFrame with the Random Walk title", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("heading", { level: 1, name: "Random Walk" })).toBeInTheDocument();
  });

  it("renders the three slot regions with their canonical names", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });
});
```

**Step 6: Run tests + verify**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter build
```

Expected: all pass.

**Step 7: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): foundation shell — SimulationFrame composition + model types`

(Suggested files to stage when the user is ready: `packages/starter/src/main.tsx`, `packages/starter/src/app.tsx`, `packages/starter/src/app.test.tsx`, `packages/starter/src/app.scss`, `packages/starter/src/model/types.ts`.)

---

## Task 4: Starter sim — random-walk model (pure functions, TDD)

The simulation's math, isolated from React. Pure functions only — no hooks, no canvas, no JSX. Tests verify the model behavior deterministically using the shared `seededRandom` utility.

**Files:**
- Create: `packages/starter/src/model/random-walk.ts`
- Create: `packages/starter/src/model/random-walk.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  finalizeTrial,
  initialTransient,
  stepWalkers,
  summarizeDistances,
} from "./random-walk";
import type { SimInput, SimTransient } from "./types";

const baseInput: SimInput = {
  walkerCount: 50,
  stepSize: 1,
  framesPerTrial: 100,
  seed: "test-seed",
};

describe("random-walk model", () => {
  describe("initialTransient", () => {
    it("places all walkers at the origin", () => {
      const t = initialTransient(baseInput);
      expect(t.walkers).toHaveLength(baseInput.walkerCount);
      expect(t.walkers.every((w) => w.x === 0 && w.y === 0)).toBe(true);
      expect(t.frame).toBe(0);
      expect(t.avgDistanceSeries).toEqual([]);
    });
  });

  describe("stepWalkers", () => {
    it("advances every walker by at most stepSize per axis (deterministic seed)", () => {
      const t = initialTransient(baseInput);
      const next = stepWalkers(t, baseInput);
      expect(next.frame).toBe(1);
      for (const w of next.walkers) {
        expect(Math.abs(w.x)).toBeLessThanOrEqual(baseInput.stepSize);
        expect(Math.abs(w.y)).toBeLessThanOrEqual(baseInput.stepSize);
      }
    });

    it("is deterministic across runs with the same seed", () => {
      const a = stepWalkers(initialTransient(baseInput), baseInput);
      const b = stepWalkers(initialTransient(baseInput), baseInput);
      expect(a.walkers).toEqual(b.walkers);
    });

    it("samples avg-distance into avgDistanceSeries every 10 frames", () => {
      let t = initialTransient(baseInput);
      for (let i = 0; i < 30; i++) t = stepWalkers(t, baseInput);
      // Frame 30 → expect 3 samples (frames 10, 20, 30).
      expect(t.avgDistanceSeries.length).toBe(3);
      expect(t.avgDistanceSeries.every((v) => typeof v === "number" && v >= 0)).toBe(true);
    });
  });

  describe("summarizeDistances", () => {
    it("computes mean and stddev from walker positions", () => {
      const positions = [
        { x: 3, y: 4 },  // distance 5
        { x: 0, y: 0 },  // distance 0
        { x: 6, y: 8 },  // distance 10
      ];
      const summary = summarizeDistances(positions);
      expect(summary.avgDistance).toBeCloseTo(5, 5);
      // Sample stddev of [5, 0, 10] is 5.
      expect(summary.stdDevDistance).toBeCloseTo(5, 5);
    });
  });

  describe("finalizeTrial", () => {
    it("returns a SimOutput summarizing the transient at trial end", () => {
      let t: SimTransient = initialTransient(baseInput);
      for (let i = 0; i < baseInput.framesPerTrial; i++) t = stepWalkers(t, baseInput);
      const output = finalizeTrial(t);
      expect(output.avgDistance).toBeGreaterThanOrEqual(0);
      expect(output.stdDevDistance).toBeGreaterThanOrEqual(0);
      expect(output.avgDistanceSeries.length).toBeGreaterThan(0);
    });
  });
});
```

Run `yarn workspace starter test random-walk` — expect FAIL.

**Step 2: Write the model**

Create `packages/starter/src/model/random-walk.ts`:

```ts
import { seededRandom } from "@concord-consortium/mass-sims-shared";
import type { SimInput, SimOutput, SimTransient, Walker } from "./types";

const SAMPLE_EVERY = 10;

export function initialTransient(input: SimInput): SimTransient {
  return {
    frame: 0,
    walkers: Array.from({ length: input.walkerCount }, () => ({ x: 0, y: 0 })),
    avgDistanceSeries: [],
  };
}

export function stepWalkers(prev: SimTransient, input: SimInput): SimTransient {
  // Per-frame seed key — derived from the trial seed + frame index — so runs are
  // deterministic AND each frame's random draws don't reuse the previous frame's.
  const rng = seededRandom(`${input.seed}:${prev.frame}`);
  const walkers: Walker[] = prev.walkers.map((w) => ({
    x: w.x + (rng() * 2 - 1) * input.stepSize,
    y: w.y + (rng() * 2 - 1) * input.stepSize,
  }));
  const frame = prev.frame + 1;
  const series = [...prev.avgDistanceSeries];
  if (frame % SAMPLE_EVERY === 0) {
    series.push(summarizeDistances(walkers).avgDistance);
  }
  return { frame, walkers, avgDistanceSeries: series };
}

export function summarizeDistances(walkers: readonly Walker[]): {
  avgDistance: number;
  stdDevDistance: number;
} {
  if (walkers.length === 0) return { avgDistance: 0, stdDevDistance: 0 };
  const distances = walkers.map((w) => Math.hypot(w.x, w.y));
  const avgDistance = distances.reduce((s, d) => s + d, 0) / distances.length;
  // Sample standard deviation (n - 1 denominator).
  const variance = walkers.length > 1
    ? distances.reduce((s, d) => s + (d - avgDistance) ** 2, 0) / (distances.length - 1)
    : 0;
  return { avgDistance, stdDevDistance: Math.sqrt(variance) };
}

export function finalizeTrial(transient: SimTransient): SimOutput {
  const { avgDistance, stdDevDistance } = summarizeDistances(transient.walkers);
  return { avgDistance, stdDevDistance, avgDistanceSeries: [...transient.avgDistanceSeries] };
}
```

**Step 3: Run tests + verify**

```bash
yarn workspace starter test random-walk
yarn workspace starter typecheck
yarn workspace starter lint
```

Expected: all model tests pass.

**Step 4: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): add random-walk model (pure functions, seeded)`

(Suggested files to stage when the user is ready: `packages/starter/src/model/random-walk.ts`, `packages/starter/src/model/random-walk.test.ts`.)

---

## Task 5: Starter sim — simulation view (canvas + runner integration)

Adds the canvas-based view to the Simulation slot. Wires `useModelState` + `useSimulationRunner` + the random-walk model. Adds parameter controls (sliders) and play/pause/reset buttons. Drives the canvas via `requestAnimationFrame` through `useSimulationRunner`.

**Files:**
- Create: `packages/starter/src/components/simulation-view.tsx`
- Create: `packages/starter/src/components/simulation-view.scss`
- Create: `packages/starter/src/components/simulation-view.test.tsx`
- Modify: `packages/starter/src/app.tsx` (replace the placeholder)

**Step 1: Write the failing tests**

The canvas drawing itself isn't easily testable in jsdom; focus tests on the controls, runner integration, and parameter wiring.

```tsx
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimulationView } from "./simulation-view";

describe("SimulationView", () => {
  it("renders the canvas and the parameter controls", () => {
    const { getByRole, getByLabelText } = render(<SimulationView onTrialComplete={() => {}} />);
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(getByLabelText(/walker count/i)).toBeInTheDocument();
    expect(getByLabelText(/step size/i)).toBeInTheDocument();
    expect(getByLabelText(/frames per trial/i)).toBeInTheDocument();
  });

  it("toggles between Play and Pause labels when the play button is clicked", () => {
    const { getByRole } = render(<SimulationView onTrialComplete={() => {}} />);
    const button = getByRole("button", { name: /play/i });
    fireEvent.click(button);
    expect(getByRole("button", { name: /pause/i })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /pause/i }));
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("calls onTrialComplete with a trial record when framesPerTrial is reached", () => {
    const onTrialComplete = vi.fn();
    // Use a runner-aware test that drives steps via the step() control to avoid rAF in jsdom.
    const { getByRole, getByLabelText } = render(
      <SimulationView onTrialComplete={onTrialComplete} />,
    );
    // Set a very short trial so we can step through it quickly.
    fireEvent.change(getByLabelText(/frames per trial/i), { target: { value: "3" } });
    const stepButton = getByRole("button", { name: /step/i });
    fireEvent.click(stepButton);
    fireEvent.click(stepButton);
    fireEvent.click(stepButton);
    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      input: expect.any(Object),
      output: expect.any(Object),
    });
  });

  it("Reset clears the running trial back to frame 0 and re-enables the inputs", () => {
    const { getByRole, getByLabelText } = render(<SimulationView onTrialComplete={() => {}} />);
    fireEvent.click(getByRole("button", { name: /step/i }));
    fireEvent.click(getByRole("button", { name: /reset/i }));
    // After reset, the walker-count input is editable again (not locked by an in-progress trial).
    expect(getByLabelText(/walker count/i)).not.toBeDisabled();
  });
});
```

Run `yarn workspace starter test simulation-view` — expect FAIL.

**Step 2: Write the component**

Create `packages/starter/src/components/simulation-view.tsx`:

```tsx
import {
  useModelState,
  useSimulationRunner,
} from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordedTrial, SimInput, SimOutput, SimTransient } from "../model/types";
import {
  finalizeTrial,
  initialTransient,
  stepWalkers,
} from "../model/random-walk";
import "./simulation-view.scss";

// Canvas height is fixed; width tracks the Simulation column (full width, measured via
// ResizeObserver — see the resize effect below). 250px (not the original square 320) keeps
// the controls + buttons + readout within the shared frame's fixed-height, non-scrolling
// Simulation slot (562px frame → ~440px usable). Draw centers on BOTH axes since width ≠ height.
const CANVAS_HEIGHT = 250;
const WALKER_DOT_RADIUS = 2;
const DEFAULT_INPUT: SimInput = {
  walkerCount: 50,
  stepSize: 1,
  framesPerTrial: 200,
  seed: "trial-A",
};
const INITIAL_OUTPUT: SimOutput = { avgDistance: 0, stdDevDistance: 0, avgDistanceSeries: [] };

// Option-C determinism support: the random-walk model is deterministic per seed (a given
// seed + frame always reproduces the same draws), so to keep trials varying we hand each new
// trial a fresh seed. The first trial uses DEFAULT_INPUT.seed; Reset (the new-trial boundary)
// swaps in a new one. Plain Math.random is fine — seeds are not security-sensitive.
function makeSeed(): string {
  return `trial-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SimulationViewProps {
  /** Called each time a trial completes (frame count reaches framesPerTrial). */
  onTrialComplete: (trial: { input: SimInput; output: SimOutput }) => void;
}

export function SimulationView({ onTrialComplete }: SimulationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Backing-store width tracks the canvas's laid-out width so the drawing fills the column
  // without stretching. Measured via ResizeObserver (guarded — jsdom lacks it in tests).
  const [canvasWidth, setCanvasWidth] = useState(0);
  const { input, output, transient, setInput, setOutput, setTransient, resetTransient, resetOutput } =
    useModelState<SimInput, SimOutput, SimTransient>({
      initialInput: DEFAULT_INPUT,
      initialOutput: INITIAL_OUTPUT,
      initialTransient: initialTransient(DEFAULT_INPUT),
    });

  // Lock the controls once a trial is in progress (frame > 0 and not yet finalized).
  const trialInProgress = transient.frame > 0 && transient.frame < input.framesPerTrial;

  const onStep = useCallback(
    (_deltaMs: number) => {
      const next = stepWalkers(transient, input);
      setTransient(next);
      if (next.frame >= input.framesPerTrial) {
        const finalOutput = finalizeTrial(next);
        setOutput(finalOutput);
        onTrialComplete({ input, output: finalOutput });
        // Pause the runner — sim authors customize this in their own sims.
      }
    },
    [transient, input, setTransient, setOutput, onTrialComplete],
  );

  const { isPlaying, play, pause, step } = useSimulationRunner({ onStep });

  // Pause the runner on trial completion so it doesn't loop into the next frame.
  useEffect(() => {
    if (transient.frame >= input.framesPerTrial && isPlaying) {
      pause();
    }
  }, [transient.frame, input.framesPerTrial, isPlaying, pause]);

  // Track the canvas's laid-out width so its backing store matches (full column width).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setCanvasWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Canvas drawing — runs whenever the walkers move or the canvas is resized. Centers on BOTH
  // axes (width ≠ height) and draws in terms of the known dimensions so canvasWidth is a real
  // dependency (re-running on resize, after React clears the canvas by setting its width attr).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.fillStyle = "#333";
    const centerX = canvasWidth / 2;
    const centerY = CANVAS_HEIGHT / 2;
    for (const walker of transient.walkers) {
      ctx.beginPath();
      ctx.arc(centerX + walker.x, centerY + walker.y, WALKER_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [transient.walkers, canvasWidth]);

  const resetTrial = () => {
    pause();
    resetTransient();
    resetOutput();
    // Hand the next trial a fresh seed so it varies from the one just run (Option C).
    setInput((p) => ({ ...p, seed: makeSeed() }));
    setTransient(initialTransient(input));
  };

  return (
    <div className="simulation-view">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={CANVAS_HEIGHT}
        aria-label="Random walk visualization"
      />
      <div className="controls">
        <label>
          Walker count
          <input
            type="range"
            min={1}
            max={500}
            value={input.walkerCount}
            disabled={trialInProgress}
            onChange={(e) => setInput((p) => ({ ...p, walkerCount: Number(e.target.value) }))}
          />
          <span>{input.walkerCount}</span>
        </label>
        <label>
          Step size
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={input.stepSize}
            disabled={trialInProgress}
            onChange={(e) => setInput((p) => ({ ...p, stepSize: Number(e.target.value) }))}
          />
          <span>{input.stepSize.toFixed(1)}</span>
        </label>
        <label>
          Frames per trial
          <input
            type="number"
            min={1}
            max={500}
            value={input.framesPerTrial}
            disabled={trialInProgress}
            onChange={(e) =>
              setInput((p) => ({ ...p, framesPerTrial: Number(e.target.value) }))
            }
          />
        </label>
      </div>
      <div className="buttons">
        <button type="button" onClick={() => (isPlaying ? pause() : play())}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={step}>
          Step
        </button>
        <button type="button" onClick={resetTrial}>
          Reset
        </button>
      </div>
      <div className="readout">
        Frame {transient.frame} / {input.framesPerTrial} ·{" "}
        avg distance {output.avgDistance.toFixed(2)}
      </div>
    </div>
  );
}
```

**Step 3: Write the SCSS**

Create `packages/starter/src/components/simulation-view.scss`:

```scss
@use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens;

.simulation-view {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-base;
  gap: tokens.$space-2;
  padding: tokens.$space-2;

  canvas {
    background: tokens.$color-surface;
    border: tokens.$border-strong;
    border-radius: tokens.$radius-md;
    height: 250px;
    width: 100%;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: tokens.$space-1;
    width: 100%;
  }

  .controls label {
    align-items: center;
    color: tokens.$color-text;
    display: grid;
    gap: tokens.$space-2;
    grid-template-columns: 120px 1fr auto;
  }

  .controls input[type="range"],
  .controls input[type="number"] {
    width: 100%;
  }

  .buttons {
    display: flex;
    gap: tokens.$space-2;
  }

  .buttons button {
    background: tokens.$color-surface;
    border: tokens.$border-strong;
    border-radius: tokens.$radius-md;
    color: tokens.$color-text;
    cursor: pointer;
    font-family: tokens.$font-family-base;
    font-size: tokens.$font-size-base;
    font-weight: 700;
    min-height: tokens.$touch-target-min;
    padding: tokens.$space-1 tokens.$space-3;
  }

  .buttons button:hover,
  .buttons button:focus-visible {
    background: tokens.$color-surface-hover;
  }

  .buttons button:focus-visible {
    outline: tokens.$focus-outline;
    outline-offset: tokens.$focus-outline-offset;
  }

  .readout {
    color: tokens.$color-text-muted;
    font-size: tokens.$font-size-sm;
  }
}
```

**Step 4: Wire `<SimulationView>` into `app.tsx`**

Replace the simulation-slot placeholder in `app.tsx` with the real view. The trial-list integration in Task 6 will add an `onTrialComplete` handler; for Task 5 a placeholder `() => {}` is fine.

```tsx
import { SimulationFrame } from "@concord-consortium/mass-sims-shared";
import { SimulationView } from "./components/simulation-view";
import "./app.scss";

export function App() {
  return (
    <SimulationFrame
      simTitle="Random Walk"
      tagline="An interactive starter simulation"
      infoModalContent={<p>… (as before) …</p>}
    >
      <SimulationFrame.Trials>{/* Task 6 */}</SimulationFrame.Trials>
      <SimulationFrame.Simulation instruction="Choose parameters, then press Play">
        <SimulationView onTrialComplete={() => {}} />
      </SimulationFrame.Simulation>
      <SimulationFrame.Data>{/* Task 7 */}</SimulationFrame.Data>
    </SimulationFrame>
  );
}
```

**Step 5: Run tests + visual check**

```bash
yarn workspace starter test simulation-view
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter dev
# Open the printed URL. Verify canvas renders dots, Play runs the simulation,
# Pause stops, Step advances one frame, Reset clears, parameter sliders work and
# lock during a running trial.
```

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): wire random-walk SimulationView (canvas + runner + controls)`

(Suggested files to stage when the user is ready: `packages/starter/src/components/simulation-view.tsx`, `packages/starter/src/components/simulation-view.scss`, `packages/starter/src/components/simulation-view.test.tsx`, `packages/starter/src/app.tsx`.)

---

## Task 6: Starter sim — trials integration

> **⚠️ Superseded — see the "active-trial model" deviation in the Deviations log.** The code in
> this section (empty initial list, append-on-completion, `onReset` = delete) was replaced during
> implementation with a persistent active-trial model: load with an empty selected trial **A** + a
> dashed **"New"** card, run fills the *selected* trial (no append), Reset *clears* a trial (not
> delete), selecting a trial restores its final-frame snapshot, and `SimulationView` is trial-driven
> (`{ trial, onInputChange, onComplete, onReset }`). The authoritative source is the implemented
> `packages/starter/src/app.tsx` + `simulation-view.tsx`. The snippets below are kept for history.

Hoists the trial-list state to `App`, populates `<SimulationFrame.Trials>` with `<TrialCard>` children, wires selection / reset, and accepts new trials when `<SimulationView>` finishes one.

**Files:**
- Modify: `packages/starter/src/app.tsx`
- Modify: `packages/starter/src/app.test.tsx`

**Step 1: Lift trial-list state and wire TrialCards**

The trial-list state lives in `App` (not in `<SimulationView>`) because both the Trials slot and the Data slot read from it. `<SimulationView>` calls `onTrialComplete` when a trial finishes; `App` appends to the list.

> **Per-trial seeds (Option C).** No extra wiring is needed here: each completed trial's
> `input` (captured into `RecordedTrial.input`) already carries the seed that produced it,
> and `<SimulationView>`'s Reset assigns a fresh seed before the next trial begins (Task 5).
> So trials A, B, C… each record a distinct seed and therefore distinct outputs, even though
> the model is deterministic per seed.

```tsx
import { SimulationFrame, TrialCard } from "@concord-consortium/mass-sims-shared";
import { useCallback, useState } from "react";
import { SimulationView } from "./components/simulation-view";
import type { RecordedTrial, SimInput, SimOutput } from "./model/types";
import "./app.scss";

const TRIAL_LIMIT = 10; // Matches TrialCard's A–J letter cap.

function makeTrialId(): string {
  // Random id so trial ordering can't collide on rapid commits. Plain Math.random
  // is fine here — trial ids are not security-sensitive.
  return Math.random().toString(36).slice(2, 10);
}

export function App() {
  const [trials, setTrials] = useState<RecordedTrial[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const acceptTrial = useCallback(
    ({ input, output }: { input: SimInput; output: SimOutput }) => {
      setTrials((prev) => {
        if (prev.length >= TRIAL_LIMIT) return prev; // refuse silently when full
        const recorded: RecordedTrial = { id: makeTrialId(), input, output };
        return [...prev, recorded];
      });
    },
    [],
  );

  return (
    <SimulationFrame
      simTitle="Random Walk"
      tagline="An interactive starter simulation"
      infoModalContent={
        <p>
          This is the Mass Sims starter simulation — a small random-walk model that serves
          as the template for new sims. Adjust the parameters, run trials, and observe how
          the population disperses over time.
        </p>
      }
    >
      <SimulationFrame.Trials>
        {trials.map((trial, i) => (
          <TrialCard
            key={trial.id}
            index={i}
            selected={i === selectedIndex}
            onSelect={() => setSelectedIndex(i)}
            onReset={() => {
              setTrials((prev) => prev.filter((_, idx) => idx !== i));
              setSelectedIndex(null);
            }}
            resetDisabled={false}
          >
            <span>avg {trial.output.avgDistance.toFixed(1)}</span>
            <span>σ {trial.output.stdDevDistance.toFixed(1)}</span>
          </TrialCard>
        ))}
      </SimulationFrame.Trials>

      <SimulationFrame.Simulation instruction="Choose parameters, then press Play">
        <SimulationView onTrialComplete={acceptTrial} />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>{/* Task 7 wires this */}</SimulationFrame.Data>
    </SimulationFrame>
  );
}
```

**Step 2: Update the smoke test to cover trial behavior**

Add tests to `app.test.tsx`:

```tsx
it("renders no trial cards initially", () => {
  const { container } = render(<App />);
  expect(container.querySelector(".trial-card-wrapper")).toBeNull();
});

it("appends a TrialCard when SimulationView completes a trial", () => {
  // Drive a trial to completion by setting framesPerTrial = 2 and stepping twice.
  const { getByRole, getByLabelText, getAllByRole } = render(<App />);
  fireEvent.change(getByLabelText(/frames per trial/i), { target: { value: "2" } });
  const stepButton = getByRole("button", { name: /step/i });
  fireEvent.click(stepButton);
  fireEvent.click(stepButton);
  // Now a TrialCard with letter "A" exists in the Trials region.
  expect(getByRole("button", { name: "Trial A" })).toBeInTheDocument();
});
```

(Add `fireEvent` import at the top of the test file.)

**Step 3: Run tests + visual check**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter dev
# Verify: run a trial through to completion, see TrialCard A appear with the
# avg distance / stddev values. Run another trial → TrialCard B. Click cards
# to select; click the reset button on a selected card to remove that trial.
```

**Step 4: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): wire TrialCards to record completed trials`

(Suggested files to stage when the user is ready: `packages/starter/src/app.tsx`, `packages/starter/src/app.test.tsx`.)

---

## Task 7: Starter sim — data panel

Populates `<SimulationFrame.Data>` with two `<DataSubsection>` children:

1. **"Summary statistics"** — aggregated avg distance + stddev across ALL trials (a numeric readout).
2. **"Avg distance over time"** — a small canvas line chart showing the most recently selected trial's `avgDistanceSeries`.

**Files:**
- Create: `packages/starter/src/components/data-panel.tsx`
- Create: `packages/starter/src/components/data-panel.scss`
- Create: `packages/starter/src/components/data-panel.test.tsx`
- Modify: `packages/starter/src/app.tsx` (pass `trials` and `selectedIndex` in)

**Step 1: Write tests**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataPanel } from "./data-panel";
import type { RecordedTrial } from "../model/types";

const sampleTrial = (avg: number): RecordedTrial => ({
  id: `id-${avg}`,
  input: { walkerCount: 50, stepSize: 1, framesPerTrial: 100, seed: "x" },
  output: {
    avgDistance: avg,
    stdDevDistance: 2,
    avgDistanceSeries: [1, 2, 3, 4, 5],
  },
});

describe("DataPanel", () => {
  it("renders both DataSubsection h3 headings", () => {
    const { getAllByRole } = render(<DataPanel trials={[]} selectedIndex={null} />);
    const h3s = getAllByRole("heading", { level: 3 });
    expect(h3s).toHaveLength(2);
  });

  it("displays empty-state copy when there are no trials", () => {
    const { getByText } = render(<DataPanel trials={[]} selectedIndex={null} />);
    expect(getByText(/no trials/i)).toBeInTheDocument();
  });

  it("computes summary stats from the trial list", () => {
    const trials = [sampleTrial(4), sampleTrial(6), sampleTrial(8)];
    const { getByText } = render(<DataPanel trials={trials} selectedIndex={null} />);
    // Average of 4, 6, 8 is 6.00.
    expect(getByText(/6\.00/)).toBeInTheDocument();
  });

  it("renders the time-series canvas only when a trial is selected", () => {
    const trials = [sampleTrial(5)];
    const { queryByLabelText: q1 } = render(<DataPanel trials={trials} selectedIndex={null} />);
    expect(q1(/avg distance over time/i)).toBeNull();
    const { getByLabelText } = render(<DataPanel trials={trials} selectedIndex={0} />);
    expect(getByLabelText(/avg distance over time/i)).toBeInTheDocument();
  });
});
```

**Step 2: Write the component**

```tsx
import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { useEffect, useRef } from "react";
import type { RecordedTrial } from "../model/types";
import "./data-panel.scss";

export interface DataPanelProps {
  trials: readonly RecordedTrial[];
  selectedIndex: number | null;
}

export function DataPanel({ trials, selectedIndex }: DataPanelProps) {
  const summary = computeSummary(trials);
  const selectedSeries =
    selectedIndex !== null && selectedIndex < trials.length
      ? trials[selectedIndex].output.avgDistanceSeries
      : null;

  return (
    <>
      <DataSubsection title="Summary statistics">
        {trials.length === 0 ? (
          <p className="empty">No trials yet — run one to start collecting data.</p>
        ) : (
          <dl className="summary">
            <dt>Trials run</dt>
            <dd>{trials.length}</dd>
            <dt>Average distance</dt>
            <dd>{summary.avgDistance.toFixed(2)}</dd>
            <dt>Std. deviation</dt>
            <dd>{summary.stdDevDistance.toFixed(2)}</dd>
          </dl>
        )}
      </DataSubsection>
      <DataSubsection title="Avg distance over time">
        {selectedSeries ? (
          <SeriesCanvas series={selectedSeries} />
        ) : (
          <p className="empty">Select a trial to see its time series.</p>
        )}
      </DataSubsection>
    </>
  );
}

function computeSummary(trials: readonly RecordedTrial[]): { avgDistance: number; stdDevDistance: number } {
  if (trials.length === 0) return { avgDistance: 0, stdDevDistance: 0 };
  const distances = trials.map((t) => t.output.avgDistance);
  const avgDistance = distances.reduce((s, d) => s + d, 0) / distances.length;
  const variance = trials.length > 1
    ? distances.reduce((s, d) => s + (d - avgDistance) ** 2, 0) / (distances.length - 1)
    : 0;
  return { avgDistance, stdDevDistance: Math.sqrt(variance) };
}

function SeriesCanvas({ series }: { series: readonly number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    if (series.length < 2) return;
    const max = Math.max(...series, 1);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - (v / max) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [series]);
  return <canvas ref={ref} width={240} height={80} aria-label="Avg distance over time" />;
}
```

**Step 3: Write the SCSS**

```scss
@use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens;

.summary {
  color: tokens.$color-text;
  display: grid;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-base;
  gap: tokens.$space-1 tokens.$space-2;
  grid-template-columns: auto auto;
  margin: 0;
}

.summary dt {
  font-weight: 400;
}

.summary dd {
  font-weight: 700;
  margin: 0;
  text-align: right;
}

.empty {
  color: tokens.$color-text-muted;
  font-family: tokens.$font-family-base;
  font-size: tokens.$font-size-sm;
  margin: 0;
  text-align: center;
}
```

**Step 4: Wire `<DataPanel>` into `app.tsx`**

```tsx
<SimulationFrame.Data>
  <DataPanel trials={trials} selectedIndex={selectedIndex} />
</SimulationFrame.Data>
```

**Step 5: Run tests + visual check**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
yarn workspace starter dev
# Run a trial to completion → summary updates. Click a TrialCard to select it →
# the time-series chart appears. Select a different trial → chart updates.
```

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): add DataPanel with summary stats + time-series chart`

(Suggested files to stage when the user is ready: `packages/starter/src/components/data-panel.tsx`, `packages/starter/src/components/data-panel.scss`, `packages/starter/src/components/data-panel.test.tsx`, `packages/starter/src/app.tsx`.)

---

## Task 8: Starter sim — reload-warning wiring

Wire `useReloadWarning` into `App` so the browser prompts "Leave site?" when at least one trial has been recorded. This is a one-line wiring + a test.

**Files:**
- Modify: `packages/starter/src/app.tsx`
- Modify: `packages/starter/src/app.test.tsx`

**Step 1: Wire `useReloadWarning`**

Add the import + hook call to `App`:

```tsx
import { useReloadWarning } from "@concord-consortium/mass-sims-shared";

// … inside App, alongside the other hooks:
useReloadWarning(trials.length > 0);
```

**Step 2: Test the wiring**

```tsx
it("registers a beforeunload listener once at least one trial has been recorded", () => {
  const addSpy = vi.spyOn(window, "addEventListener");
  const { getByRole, getByLabelText } = render(<App />);
  fireEvent.change(getByLabelText(/frames per trial/i), { target: { value: "2" } });
  fireEvent.click(getByRole("button", { name: /step/i }));
  fireEvent.click(getByRole("button", { name: /step/i }));
  // After the trial completes, the reload-warning listener should be attached.
  expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  addSpy.mockRestore();
});

it("does NOT register a beforeunload listener when no trials exist", () => {
  const addSpy = vi.spyOn(window, "addEventListener");
  render(<App />);
  expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
  addSpy.mockRestore();
});
```

(Add `vi` to the vitest import in `app.test.tsx`.)

**Step 3: Run tests + verify**

```bash
yarn workspace starter test
yarn workspace starter typecheck
yarn workspace starter lint
```

**Step 4: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(starter): warn on reload once trials have been recorded`

(Suggested files to stage when the user is ready: `packages/starter/src/app.tsx`, `packages/starter/src/app.test.tsx`.)

---

## Task 9: Documentation updates

Update `docs/infrastructure-plan.md` §3 to lock in the concrete signatures of `useModelState` and `useSimulationRunner` (until now they were summary mentions).

**Files:**
- Modify: `docs/infrastructure-plan.md`

**Step 1: Update §3 "Hooks contract"**

Find the existing bullets for `useModelState` and `useSimulationRunner` (around lines 184–185). Replace them with the concrete signatures matching what's been implemented:

```markdown
- `useModelState<IInput, IOutput, ITransient>({ initialInput, initialOutput, initialTransient })` — returns `{ input, output, transient, setInput, setOutput, setTransient, resetTransient, resetOutput, resetAll }`. Three typed state shapes: input (user-controlled parameters), output (per-trial accumulated record), transient (per-frame model state). Setters follow standard React semantics (value or updater). Three reset helpers: `resetTransient` between trials, `resetOutput` to clear accumulated stats, `resetAll` on full sim reset. Trial-list management is the sim's responsibility (no built-in trial-list state).
- `useSimulationRunner({ onStep, stepDeltaMs })` — returns `{ isPlaying, play, pause, step }`. Composes `useFrameLoop` underneath. `onStep` runs on every animation frame while `isPlaying` and once per `step()` invocation; `stepDeltaMs` defaults to 16 ms.
```

**Step 2: No other doc updates needed** — `ui-design-plan.md` and the Phase 2a plan don't reference these hooks except by name.

**Step 3: Stop and wait for user review before doing anything else**

Suggest the commit message: `docs: lock in useModelState and useSimulationRunner signatures`

(Suggested files to stage when the user is ready: `docs/infrastructure-plan.md`.)

---

## Task 10: Full-repo verification

**Step 1: Run the whole repo's checks**

```bash
yarn typecheck
yarn lint
yarn test
yarn gen-index --check
```

Expected: all pass. `gen-index --check` confirms the root `index.html` still matches the workspace list.

**Step 2: Confirm sims still build**

```bash
MASS_SIMS_VERSION_PATH=version/release yarn build
```

Expected: `sim-one`, `sim-two`, `starter` (now a real sim with a non-trivial build) all build cleanly.

**Step 3: Final visual sweep**

```bash
yarn workspace starter dev
```

Open the printed URL. Confirm:

- The 50 px title bar shows "Random Walk" + tagline left, DESE / CC logos + About button right.
- The Simulation slot canvas renders; Play starts the simulation, Pause stops it, Step advances one frame, Reset clears.
- Parameter sliders work and lock during a running trial.
- Running a trial to completion appends a TrialCard (A, B, C, …) to the Trials column with the avg-distance and stddev numbers.
- Clicking a TrialCard selects it; the time-series chart in the Data panel updates to show that trial's series. Clicking the reset button on a selected card removes that trial.
- The "Summary statistics" subsection updates as trials accumulate.
- Clicking About opens the draggable side panel; close button + Escape close it; About again toggles closed.
- After at least one trial exists, attempting to navigate away triggers the browser's "Leave site?" prompt.

No commit for Task 10 — verification only.

---

## Done criteria

- [ ] `useModelState<IInput, IOutput, ITransient>` exported and tested.
- [ ] `useSimulationRunner` exported and tested; composes `useFrameLoop` correctly.
- [ ] `packages/starter/` is a real sim that composes `<SimulationFrame>`, `<TrialCard>`, and `<DataSubsection>`.
- [ ] The Starter renders a random-walk model with adjustable parameters (walker count, step size, frames per trial), drives the canvas via `useSimulationRunner`, and records up to 10 trials.
- [ ] Trial-list state is hoisted to `App`; both Trials and Data slots read from it.
- [ ] Selecting a TrialCard updates the Data panel's time-series chart.
- [ ] Resetting a TrialCard removes that trial from the list.
- [ ] `useReloadWarning` is wired and fires only when at least one trial exists.
- [ ] About panel renders with sim-specific content (random-walk explanation).
- [ ] `docs/infrastructure-plan.md` §3 reflects the concrete hook signatures.
- [ ] `yarn typecheck && yarn lint && yarn test && yarn gen-index --check && yarn build` all green; visual sweep at the four target widths passes (the wide-mode 3-column grid intentionally overflows at 676 — narrow mode is still designer-pending).

---

## Deferred follow-ups (out of scope here)

- iframe-phone embedding (Phase 2c).
- Dual-transport `useLogEvent` (lara-interactive-api + GA4) and the per-control automatic event emission described in infrastructure plan §9 (Phase 2c).
- `yarn new-sim <name>` scaffolding script and `scripts/gen-workflows.ts` (Phase 2c).
- Section's notched-chip visual treatment (still deferred from Phase 2a).
- Narrow-mode (676 px) collapsible/overlay behavior (Q30, designer working on it).
- Charting library decision (Q19) — Starter uses raw canvas; first sim that needs grouped/stacked charts forces the decision.
- A dedicated trial-list hook (e.g. `useTrialList<I, O>`) if the per-sim ad-hoc trial-list state proves repetitive across the next 2–3 sims.
- Empty-state copy / styling polish (Q35).
