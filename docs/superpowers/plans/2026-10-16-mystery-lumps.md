# Mystery Lumps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable Mystery Lumps sim — five fixed lumps, four destructive tests with one shot each, two free actions, and an evidence record — per `docs/superpowers/specs/2026-10-15-mystery-lumps-design.md`.

**Architecture:** All the science lives in one pure function, `observe(substance, test, setting, priorResult)`, which the unit tests point at and every component reads through. Trial state is a plain immutable record with pure transition helpers. `app.tsx` follows the Starter's trial-list pattern almost verbatim — it is the proven shape for trials + AP saved state in this repo.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, Biome, `@concord-consortium/mass-sims-shared` (`SimulationFrame`, `TrialCard`, `Select`, `Button`, `DataSubsection`).

**Deliberately rough on this pass:** station visuals are CSS shapes and colors, not drawn art. Getting the pieces talking matters more than how they look; a design pass comes later.

---

## File structure

```
simulations/mystery-lumps/
  src/
    app.tsx                      trial list, AP saved-state sync, the three slots
    app.scss
    model/
      substances.ts              SubstanceId, LumpId, the fixed assignment
      tests.ts                   TestId, settings, per-test metadata
      observe.ts                 observe() — every fact in the spec's table
      observe.test.ts
      trial.ts                   Trial, LumpRecord, pure transitions
      trial.test.ts
      saved-state.ts             SavedState
    components/
      lump-station.tsx/.scss     one lump: apparatus, visual state, handle/waft
      lump-row.tsx               the five stations
      lump-row.test.tsx
      test-settings.tsx/.scss    Lump / Test / Setting selects, Run, Reset Trial
      test-settings.test.tsx
      trial-card-body.tsx        the rows inside a shared <TrialCard>
      evidence-panel.tsx/.scss   the Data region
      evidence-panel.test.tsx
```

`observe.ts` is the only place a caption or a threshold is written down. `tests.ts` is the only place "does this consume the lump" is written down. Everything else reads them.

---

### Task 1: Scaffold the workspace

**Files:**
- Create: `simulations/mystery-lumps/` (generated)
- Modify: `index.html`, `.github/workflows/sim-mystery-lumps.yml` (generated)
- Modify: `simulations/mystery-lumps/src/app.tsx`

- [ ] **Step 1: Scaffold and link**

```bash
cd /Users/lbondaryk/Desktop/mass-sims
yarn new-sim mystery-lumps
yarn install
yarn gen-index
yarn gen-workflows
```

- [ ] **Step 2: Confirm the scaffold builds before touching it**

Run: `yarn workspace mystery-lumps typecheck && yarn workspace mystery-lumps test && yarn workspace mystery-lumps build`
Expected: all three pass — this is still the unmodified random-walk starter.

- [ ] **Step 3: Set the sim's identity**

In `simulations/mystery-lumps/src/app.tsx`, replace the `SimulationFrame` props:

```tsx
<SimulationFrame
  simTitle="Mystery Lumps"
  tagline="Five white lumps washed up on a beach. What are they?"
  infoModalContent={
    <p>
      Five lumps were collected from a beach. Each one has enough material for a single
      test, so choose carefully — but you can look at them and smell them as often as you
      like. Record what you observe; the simulation will not tell you what anything is.
    </p>
  }
>
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Scaffold the Mystery Lumps sim (MAS-57)"
```

---

### Task 2: Substances and tests

**Files:**
- Create: `simulations/mystery-lumps/src/model/substances.ts`
- Create: `simulations/mystery-lumps/src/model/tests.ts`

- [ ] **Step 1: Write `substances.ts`**

```ts
export type SubstanceId = "seashell" | "sea-salt" | "sea-glass" | "palm-oil" | "paraffin";
export type LumpId = "A" | "B" | "C" | "D" | "E";

export const LUMP_IDS = ["A", "B", "C", "D", "E"] as const satisfies readonly LumpId[];

/**
 * The same five lumps for every student, so a class can say "lump C" and mean one thing.
 * Scrambled relative to how the substances are listed anywhere else, so the order itself
 * gives nothing away.
 */
export const LUMP_ASSIGNMENT: Record<LumpId, SubstanceId> = {
  A: "paraffin",
  B: "sea-salt",
  C: "sea-glass",
  D: "palm-oil",
  E: "seashell",
};
```

- [ ] **Step 2: Write `tests.ts`**

```ts
export type TestId = "handle" | "waft" | "water" | "vinegar" | "bath" | "lamp";

/** Bath temperatures in °C, and lamp exposures, as the dropdowns offer them. */
export type BathTemp = "20" | "40" | "60" | "80";
export type Exposure = "seconds" | "hour" | "day" | "fortnight";
export type SettingId = BathTemp | Exposure;

export interface SettingOption {
  id: SettingId;
  label: string;
}

export interface TestMeta {
  label: string;
  /** Whether running it uses up the lump's one shot. Handling and wafting do not. */
  consumes: boolean;
  /** Empty when the test has no dial; the Setting dropdown disables itself then. */
  settings: readonly SettingOption[];
}

const BATH_TEMPS: readonly SettingOption[] = [
  { id: "20", label: "20 °C" },
  { id: "40", label: "40 °C" },
  { id: "60", label: "60 °C" },
  { id: "80", label: "80 °C" },
];

const EXPOSURES: readonly SettingOption[] = [
  { id: "seconds", label: "A few seconds" },
  { id: "hour", label: "An hour" },
  { id: "day", label: "A day" },
  { id: "fortnight", label: "Two weeks" },
];

export const TESTS: Record<TestId, TestMeta> = {
  handle: { label: "Handle", consumes: false, settings: [] },
  waft: { label: "Waft", consumes: false, settings: [] },
  water: { label: "Water", consumes: true, settings: [] },
  vinegar: { label: "Vinegar", consumes: true, settings: [] },
  bath: { label: "Warm bath", consumes: true, settings: BATH_TEMPS },
  lamp: { label: "UV lamp", consumes: true, settings: EXPOSURES },
};

/** The tests the settings grid offers — the destructive four, in the spec's order. */
export const CONSUMING_TESTS = ["water", "vinegar", "bath", "lamp"] as const satisfies
  readonly TestId[];
```

- [ ] **Step 3: Typecheck**

Run: `yarn workspace mystery-lumps typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add simulations/mystery-lumps/src/model
git commit -m "Add the substances and the test catalog (MAS-57)"
```

---

### Task 3: `observe()` — the science

This is the task that matters. Every caption and threshold in the spec's table lands here and
nowhere else.

**Files:**
- Create: `simulations/mystery-lumps/src/model/observe.ts`
- Test: `simulations/mystery-lumps/src/model/observe.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { observe } from "./observe";

describe("observe", () => {
  it("names the salt by handling, and leaves two look-alike pairs", () => {
    expect(observe("sea-salt", "handle", null).caption).toMatch(/crystals/);
    // The pairs read word for word the same — that is the whole point.
    expect(observe("seashell", "handle", null).caption)
      .toBe(observe("sea-glass", "handle", null).caption);
    expect(observe("paraffin", "handle", null).caption)
      .toBe(observe("palm-oil", "handle", null).caption);
  });

  it("fizzes only the seashell in vinegar", () => {
    expect(observe("seashell", "vinegar", null).visual).toBe("fizzing");
    for (const s of ["sea-glass", "palm-oil", "paraffin"] as const) {
      expect(observe(s, "vinegar", null).visual).toBe("none");
    }
    // Salt dissolves in vinegar too — it is mostly water — but without bubbles.
    expect(observe("sea-salt", "vinegar", null).visual).toBe("dissolving");
  });

  it("dissolves the salt in water and leaves everything else alone", () => {
    expect(observe("sea-salt", "water", null).visual).toBe("dissolving");
    for (const s of ["seashell", "sea-glass", "palm-oil", "paraffin"] as const) {
      expect(observe(s, "water", null).visual).toBe("none");
    }
  });

  it("splits the waxes on either side of their softening points", () => {
    expect(observe("palm-oil", "bath", "20").visual).toBe("none");
    expect(observe("palm-oil", "bath", "40").visual).toBe("melting");
    expect(observe("paraffin", "bath", "40").visual).toBe("none");
    expect(observe("paraffin", "bath", "60").visual).toBe("softening");
  });

  it("never changes the shell or the glass in the bath, at any temperature", () => {
    for (const temp of ["20", "40", "60", "80"] as const) {
      expect(observe("seashell", "bath", temp).visual).toBe("none");
      expect(observe("sea-glass", "bath", temp).visual).toBe("none");
    }
  });

  it("dissolves the salt at every bath temperature, faster when warm", () => {
    expect(observe("sea-salt", "bath", "20").visual).toBe("dissolving");
    expect(observe("sea-salt", "bath", "20").caption).toMatch(/slowly/);
    expect(observe("sea-salt", "bath", "80").caption).toMatch(/quickly/);
  });

  it("glows the glass and the palm oil at any exposure, and nothing else ever", () => {
    for (const e of ["seconds", "hour", "day", "fortnight"] as const) {
      expect(observe("sea-glass", "lamp", e).visual).toBe("glowing");
      expect(observe("palm-oil", "lamp", e).visual).toBe("glowing");
      expect(observe("seashell", "lamp", e).visual).toBe("none");
      expect(observe("sea-salt", "lamp", e).visual).toBe("none");
    }
  });

  it("degrades the paraffin only after the long exposure", () => {
    expect(observe("paraffin", "lamp", "day").visual).toBe("none");
    expect(observe("paraffin", "lamp", "fortnight").visual).toBe("degrading");
    expect(observe("paraffin", "lamp", "fortnight").caption).toMatch(/yellow/);
  });

  it("gives up the rancid smell only after the lamp has worked on the palm oil", () => {
    const noSmell = { test: "lamp", setting: "hour" } as const;
    const degraded = { test: "lamp", setting: "day" } as const;
    expect(observe("palm-oil", "waft", null, null).visual).toBe("no-smell");
    expect(observe("palm-oil", "waft", null, noSmell).visual).toBe("no-smell");
    expect(observe("palm-oil", "waft", null, degraded).visual).toBe("rancid");
    // Nothing else smells, however it was treated.
    expect(observe("paraffin", "waft", null, degraded).visual).toBe("no-smell");
  });

  it("never interprets a result", () => {
    const banned = /carbonate|calcium|wax is|salt is|glass is|it is .*(oil|wax|shell|glass|salt)/i;
    for (const s of ["seashell", "sea-salt", "sea-glass", "palm-oil", "paraffin"] as const) {
      for (const t of ["handle", "waft", "water", "vinegar"] as const) {
        expect(observe(s, t, null).caption).not.toMatch(banned);
      }
      for (const temp of ["20", "40", "60", "80"] as const) {
        expect(observe(s, "bath", temp).caption).not.toMatch(banned);
      }
      for (const e of ["seconds", "hour", "day", "fortnight"] as const) {
        expect(observe(s, "lamp", e).caption).not.toMatch(banned);
      }
    }
  });

  it("states the time each test stands for", () => {
    expect(observe("sea-glass", "lamp", "fortnight").elapsed).toBe("two weeks");
    expect(observe("sea-salt", "water", null).elapsed).toBe("30 seconds");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn workspace mystery-lumps test observe`
Expected: FAIL — `observe.ts` does not exist.

- [ ] **Step 3: Write `observe.ts`**

```ts
import type { SubstanceId } from "./substances";
import type { SettingId, TestId } from "./tests";

/** What a station draws. One per distinct thing a student can see or smell. */
export type VisualKey =
  | "none"
  | "crystals"
  | "hard-smooth"
  | "waxy"
  | "dissolving"
  | "fizzing"
  | "glowing"
  | "melting"
  | "softening"
  | "degrading"
  | "rancid"
  | "no-smell";

export interface Observation {
  /** Describes what happens. Never names a substance or a class of substance. */
  caption: string;
  visual: VisualKey;
  /** The time the four-second animation stands for, stated rather than hidden. */
  elapsed: string;
}

export interface PriorResult {
  test: TestId;
  setting: SettingId | null;
}

const NOTHING = "The lump sits where it was put. Nothing changes.";

const HANDLE: Record<SubstanceId, Observation> = {
  "sea-salt": {
    caption: "A crust of small cube-shaped crystals. They crumble between your fingers.",
    visual: "crystals",
    elapsed: "a few seconds",
  },
  // The two hard lumps and the two waxy lumps are deliberately word-for-word identical:
  // handling sorts them into pairs and must never split a pair.
  seashell: { caption: "Hard and smooth, cool to the touch.", visual: "hard-smooth", elapsed: "a few seconds" },
  "sea-glass": { caption: "Hard and smooth, cool to the touch.", visual: "hard-smooth", elapsed: "a few seconds" },
  paraffin: { caption: "Waxy and pale. It gives a little under a fingernail.", visual: "waxy", elapsed: "a few seconds" },
  "palm-oil": { caption: "Waxy and pale. It gives a little under a fingernail.", visual: "waxy", elapsed: "a few seconds" },
};

const EXPOSURE_TIME: Record<string, string> = {
  seconds: "a few seconds",
  hour: "an hour",
  day: "a day",
  fortnight: "two weeks",
};

/** Exposures long enough to break something down, as opposed to merely light it up. */
const LONG_EXPOSURES = new Set(["day", "fortnight"]);

function inWater(substance: SubstanceId, vinegar: boolean): Observation {
  if (substance === "sea-salt") {
    return {
      caption: vinegar
        ? "The lump shrinks away to nothing. No bubbles."
        : "The lump shrinks away to nothing. The water stays clear.",
      visual: "dissolving",
      elapsed: "30 seconds",
    };
  }
  if (vinegar && substance === "seashell") {
    return {
      caption: "A steady stream of small bubbles rises from the lump.",
      visual: "fizzing",
      elapsed: "30 seconds",
    };
  }
  return { caption: NOTHING, visual: "none", elapsed: "30 seconds" };
}

function inBath(substance: SubstanceId, setting: SettingId | null): Observation {
  const temp = Number(setting ?? "20");
  const elapsed = "30 seconds";
  if (substance === "sea-salt") {
    return {
      caption:
        temp >= 40
          ? "The lump shrinks away quickly. The water stays clear."
          : "The lump shrinks away slowly. The water stays clear.",
      visual: "dissolving",
      elapsed,
    };
  }
  if (substance === "palm-oil" && temp >= 40) {
    return {
      caption: "The lump slumps, then runs into a pool at the bottom.",
      visual: "melting",
      elapsed,
    };
  }
  if (substance === "paraffin" && temp >= 60) {
    return {
      caption: "The lump turns glossy and sags at the edges, but keeps its shape.",
      visual: "softening",
      elapsed,
    };
  }
  return { caption: NOTHING, visual: "none", elapsed };
}

function underLamp(substance: SubstanceId, setting: SettingId | null): Observation {
  const exposure = String(setting ?? "seconds");
  const elapsed = EXPOSURE_TIME[exposure] ?? "a few seconds";
  const long = LONG_EXPOSURES.has(exposure);
  if (substance === "sea-glass") {
    return { caption: "The lump shines with a pale blue-white glow.", visual: "glowing", elapsed };
  }
  if (substance === "palm-oil") {
    return {
      caption: long
        ? "The lump glows a dull yellow-green. Its surface looks damp and darkened."
        : "The lump glows a dull yellow-green.",
      visual: "glowing",
      elapsed,
    };
  }
  if (substance === "paraffin" && long) {
    return {
      caption:
        "The lump has turned yellow, its surface is powdery, and a corner has crumbled away.",
      visual: "degrading",
      elapsed,
    };
  }
  return { caption: "The lump stays dark. Nothing changes.", visual: "none", elapsed };
}

function waft(substance: SubstanceId, prior: PriorResult | null): Observation {
  const degraded =
    substance === "palm-oil" &&
    prior?.test === "lamp" &&
    LONG_EXPOSURES.has(String(prior.setting));
  return degraded
    ? { caption: "A sharp, rancid smell.", visual: "rancid", elapsed: "a moment" }
    : { caption: "No smell to speak of.", visual: "no-smell", elapsed: "a moment" };
}

/**
 * What a student observes. Pure and exhaustive — every fact in the design spec's table lives
 * here and nowhere else, which is why the unit tests point at this function rather than at
 * the components that render it.
 *
 * `prior` is the lump's already-spent test, which only wafting depends on: palm oil smells
 * rancid once the lamp has had long enough to break it down, and not before.
 */
export function observe(
  substance: SubstanceId,
  test: TestId,
  setting: SettingId | null,
  prior: PriorResult | null = null,
): Observation {
  switch (test) {
    case "handle":
      return HANDLE[substance];
    case "waft":
      return waft(substance, prior);
    case "water":
      return inWater(substance, false);
    case "vinegar":
      return inWater(substance, true);
    case "bath":
      return inBath(substance, setting);
    case "lamp":
      return underLamp(substance, setting);
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `yarn workspace mystery-lumps test observe`
Expected: PASS, 11 tests.

- [ ] **Step 5: Check one test actually bites**

Temporarily change `temp >= 60` to `temp >= 40` in `inBath`, re-run, and confirm "splits the
waxes on either side of their softening points" fails. Restore it.

- [ ] **Step 6: Commit**

```bash
git add simulations/mystery-lumps/src/model/observe.ts simulations/mystery-lumps/src/model/observe.test.ts
git commit -m "Add observe(), the whole science model (MAS-57)"
```

---

### Task 4: Trial state

**Files:**
- Create: `simulations/mystery-lumps/src/model/trial.ts`
- Create: `simulations/mystery-lumps/src/model/saved-state.ts`
- Test: `simulations/mystery-lumps/src/model/trial.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  applyTest,
  clearTrial,
  makeEmptyTrial,
  markHandled,
  markWafted,
  untestedLumps,
} from "./trial";

describe("trial", () => {
  it("starts with five lumps, none touched", () => {
    const trial = makeEmptyTrial();
    expect(untestedLumps(trial)).toEqual(["A", "B", "C", "D", "E"]);
    expect(trial.lumps.A).toEqual({ handled: false, wafted: false, result: null });
  });

  it("spends a lump's one shot, and offers it no more", () => {
    const trial = applyTest(makeEmptyTrial(), "C", "lamp", "fortnight");
    expect(trial.lumps.C.result).toEqual({ test: "lamp", setting: "fortnight" });
    expect(untestedLumps(trial)).toEqual(["A", "B", "D", "E"]);
  });

  it("refuses a second destructive test on the same lump", () => {
    const once = applyTest(makeEmptyTrial(), "C", "lamp", "fortnight");
    const twice = applyTest(once, "C", "vinegar", null);
    expect(twice.lumps.C.result).toEqual({ test: "lamp", setting: "fortnight" });
    expect(twice).toBe(once); // unchanged, same reference
  });

  it("lets a lump be handled and wafted even after its test is spent", () => {
    let trial = applyTest(makeEmptyTrial(), "D", "lamp", "day");
    trial = markWafted(markHandled(trial, "D"), "D");
    expect(trial.lumps.D).toMatchObject({ handled: true, wafted: true });
    expect(trial.lumps.D.result).toEqual({ test: "lamp", setting: "day" });
  });

  it("clears a trial in place, keeping its id", () => {
    const trial = markHandled(applyTest(makeEmptyTrial(), "A", "water", null), "B");
    const cleared = clearTrial(trial);
    expect(cleared.id).toBe(trial.id);
    expect(untestedLumps(cleared)).toHaveLength(5);
    expect(cleared.lumps.B.handled).toBe(false);
  });

  it("does not mutate the trial it was given", () => {
    const before = makeEmptyTrial();
    applyTest(before, "A", "water", null);
    expect(before.lumps.A.result).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn workspace mystery-lumps test trial`
Expected: FAIL — `trial.ts` does not exist.

- [ ] **Step 3: Write `trial.ts`**

```ts
import { LUMP_IDS, type LumpId } from "./substances";
import type { SettingId, TestId } from "./tests";

export interface LumpRecord {
  handled: boolean;
  wafted: boolean;
  /** The one destructive test this lump has been given, or null while it still has material. */
  result: { test: TestId; setting: SettingId | null } | null;
}

export interface Trial {
  id: string;
  lumps: Record<LumpId, LumpRecord>;
}

// Ids are not security-sensitive; Math.random is fine, as in the Starter.
function makeTrialId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeEmptyTrial(): Trial {
  const lumps = {} as Record<LumpId, LumpRecord>;
  for (const id of LUMP_IDS) lumps[id] = { handled: false, wafted: false, result: null };
  return { id: makeTrialId(), lumps };
}

/** The lumps that still have material for a destructive test. */
export function untestedLumps(trial: Trial): LumpId[] {
  return LUMP_IDS.filter((id) => trial.lumps[id].result === null);
}

function withLump(trial: Trial, lump: LumpId, patch: Partial<LumpRecord>): Trial {
  return { ...trial, lumps: { ...trial.lumps, [lump]: { ...trial.lumps[lump], ...patch } } };
}

/**
 * Spends a lump's one shot. Returns the trial unchanged — same reference, so React skips the
 * render — if that lump has already been tested, which is the one-shot rule enforced in the
 * one place rather than in every caller.
 */
export function applyTest(
  trial: Trial,
  lump: LumpId,
  test: TestId,
  setting: SettingId | null,
): Trial {
  if (trial.lumps[lump].result !== null) return trial;
  return withLump(trial, lump, { result: { test, setting } });
}

export function markHandled(trial: Trial, lump: LumpId): Trial {
  return withLump(trial, lump, { handled: true });
}

export function markWafted(trial: Trial, lump: LumpId): Trial {
  return withLump(trial, lump, { wafted: true });
}

/** Empties a trial but keeps its identity, so its card stays in place. */
export function clearTrial(trial: Trial): Trial {
  return { ...makeEmptyTrial(), id: trial.id };
}
```

- [ ] **Step 4: Write `saved-state.ts`**

```ts
import type { Trial } from "./trial";

/**
 * Only plain JSON. Captions are not stored — they are derived from `observe()` on render, so a
 * wording fix reaches work a student saved earlier. Animation progress is never persisted.
 */
export interface SavedState {
  trials: Trial[];
  selectedId: string;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `yarn workspace mystery-lumps test trial`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add simulations/mystery-lumps/src/model
git commit -m "Add trial state and its transitions (MAS-57)"
```

---

### Task 5: The lump row

**Files:**
- Create: `simulations/mystery-lumps/src/components/lump-station.tsx`
- Create: `simulations/mystery-lumps/src/components/lump-station.scss`
- Create: `simulations/mystery-lumps/src/components/lump-row.tsx`
- Test: `simulations/mystery-lumps/src/components/lump-row.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { LumpRow } from "./lump-row";

const noop = () => undefined;

describe("LumpRow", () => {
  it("shows all five lumps", () => {
    const { getAllByRole } = render(
      <LumpRow trial={makeEmptyTrial()} onHandle={noop} onWaft={noop} runningLump={null} />,
    );
    // Each station offers handle and waft, so ten buttons for five lumps.
    expect(getAllByRole("button", { name: /handle lump/i })).toHaveLength(5);
    expect(getAllByRole("button", { name: /waft lump/i })).toHaveLength(5);
  });

  it("reports which lump was handled", () => {
    const onHandle = vi.fn();
    const { getByRole } = render(
      <LumpRow trial={makeEmptyTrial()} onHandle={onHandle} onWaft={noop} runningLump={null} />,
    );
    fireEvent.click(getByRole("button", { name: /handle lump c/i }));
    expect(onHandle).toHaveBeenCalledWith("C");
  });

  it("keeps handling and wafting available on a spent lump", () => {
    const trial = applyTest(makeEmptyTrial(), "C", "water", null);
    const { getByRole } = render(
      <LumpRow trial={trial} onHandle={noop} onWaft={noop} runningLump={null} />,
    );
    // The spent lump is the one case where a free action still has to work.
    expect(getByRole("button", { name: /handle lump c/i })).toBeEnabled();
    expect(getByRole("button", { name: /waft lump c/i })).toBeEnabled();
  });

  it("captions a spent lump with what was done to it", () => {
    const trial = applyTest(makeEmptyTrial(), "E", "vinegar", null);
    const { getByText } = render(
      <LumpRow trial={trial} onHandle={noop} onWaft={noop} runningLump={null} />,
    );
    // Lump E is the seashell, so vinegar fizzes.
    expect(getByText(/steady stream of small bubbles/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn workspace mystery-lumps test lump-row`
Expected: FAIL — `lump-row.tsx` does not exist.

- [ ] **Step 3: Write `lump-station.tsx`**

```tsx
import clsx from "clsx";
import { LUMP_ASSIGNMENT, type LumpId } from "../model/substances";
import { observe } from "../model/observe";
import type { LumpRecord } from "../model/trial";

import "./lump-station.scss";

export interface LumpStationProps {
  lump: LumpId;
  record: LumpRecord;
  running: boolean;
  onHandle: (lump: LumpId) => void;
  onWaft: (lump: LumpId) => void;
}

/**
 * One lump, with whatever apparatus its test put it in. The lump stays in place for the whole
 * trial and keeps its end state afterwards — an empty tube where the salt dissolved — so the
 * row doubles as a picture of the trial.
 *
 * Handling and wafting are buttons on the lump rather than entries in the settings grid: both
 * are free, and putting them here means a free action can never be mistaken for spending the
 * lump's one shot.
 */
export function LumpStation({ lump, record, running, onHandle, onWaft }: LumpStationProps) {
  const substance = LUMP_ASSIGNMENT[lump];
  const result = record.result;
  const observation = result ? observe(substance, result.test, result.setting) : null;

  return (
    <div className={clsx("lump-station", { running, spent: result !== null })}>
      <div className="lump-letter">{lump}</div>
      <div
        className={clsx("lump-body", observation ? `visual-${observation.visual}` : "visual-none")}
        aria-hidden="true"
      />
      <div className="lump-captions">
        {record.handled ? (
          <p className="caption handled">{observe(substance, "handle", null).caption}</p>
        ) : null}
        {observation ? <p className="caption result">{observation.caption}</p> : null}
        {record.wafted ? (
          <p className="caption smell">{observe(substance, "waft", null, result).caption}</p>
        ) : null}
      </div>
      <div className="lump-actions">
        <button type="button" onClick={() => onHandle(lump)} aria-label={`Handle lump ${lump}`}>
          Handle
        </button>
        <button type="button" onClick={() => onWaft(lump)} aria-label={`Waft lump ${lump}`}>
          Waft
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `lump-row.tsx`**

```tsx
import { LUMP_IDS, type LumpId } from "../model/substances";
import type { Trial } from "../model/trial";
import { LumpStation } from "./lump-station";

export interface LumpRowProps {
  trial: Trial;
  runningLump: LumpId | null;
  onHandle: (lump: LumpId) => void;
  onWaft: (lump: LumpId) => void;
}

export function LumpRow({ trial, runningLump, onHandle, onWaft }: LumpRowProps) {
  return (
    <div className="lump-row">
      {LUMP_IDS.map((lump) => (
        <LumpStation
          key={lump}
          lump={lump}
          record={trial.lumps[lump]}
          running={runningLump === lump}
          onHandle={onHandle}
          onWaft={onWaft}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `lump-station.scss`**

Rough on purpose — a coloured block per visual state, so the wiring can be seen working before
any art exists. Tokens come from the shared library's `tokens.scss`.

```scss
.lump-row {
  display: flex;
  gap: 6px;
  justify-content: space-between;
}

.lump-station {
  flex: 1 1 0;
  min-width: 0;
  background: #fff;
  border: 2px solid #4a7fc1;
  border-radius: 8px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &.running { box-shadow: 0 0 0 3px rgba(74, 127, 193, 0.35); }
  &.spent .lump-actions { opacity: 0.9; }
}

.lump-letter {
  background: #1b3f7a;
  color: #fff;
  border-radius: 4px;
  padding: 0 7px;
  font-weight: 700;
}

// One block per visual key. Placeholder art: the point is that each state is distinguishable
// on screen while the interaction is being tried out.
.lump-body {
  width: 34px;
  height: 34px;
  border-radius: 5px;
  background: #ededed;

  &.visual-crystals { background: repeating-linear-gradient(45deg, #fff 0 3px, #dcdcdc 3px 6px); }
  &.visual-hard-smooth { background: #e4e9ec; }
  &.visual-waxy { background: #f2efe2; }
  &.visual-dissolving { background: transparent; border: 1px dashed #aaa; }
  &.visual-fizzing { background: radial-gradient(circle at 50% 70%, #cfe8ff 0 40%, #ededed 41%); }
  &.visual-glowing { background: #d8ffb0; box-shadow: 0 0 10px 3px rgba(150, 255, 90, 0.7); }
  &.visual-melting { background: linear-gradient(#f2efe2 0 40%, #e8dfa8 41%); border-radius: 0 0 16px 16px; }
  &.visual-softening { background: #efe8cf; border-radius: 5px 5px 12px 12px; }
  &.visual-degrading { background: #ded7a0; border: 1px dotted #8a7d3a; }
}

.lump-captions {
  font-size: 11px;
  text-align: center;
  .caption { margin: 0; }
  .smell { font-style: italic; }
}

.lump-actions {
  display: flex;
  gap: 3px;
  button {
    font-size: 11px;
    border: 1px solid #4a7fc1;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `yarn workspace mystery-lumps test lump-row`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add simulations/mystery-lumps/src/components
git commit -m "Add the lump row and its stations (MAS-57)"
```

---

### Task 6: The settings grid

**Files:**
- Create: `simulations/mystery-lumps/src/components/test-settings.tsx`
- Create: `simulations/mystery-lumps/src/components/test-settings.scss`
- Test: `simulations/mystery-lumps/src/components/test-settings.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { TestSettings } from "./test-settings";

function renderGrid(trial = makeEmptyTrial(), onRun = vi.fn()) {
  const utils = render(
    <TestSettings trial={trial} running={false} onRun={onRun} onResetTrial={() => undefined} />,
  );
  return { ...utils, onRun };
}

describe("TestSettings", () => {
  it("offers only lumps that still have material", () => {
    const trial = applyTest(makeEmptyTrial(), "B", "water", null);
    const { getByRole } = renderGrid(trial);
    fireEvent.click(getByRole("button", { name: /lump/i }));
    expect(getByRole("option", { name: "A" })).toBeInTheDocument();
    expect(() => getByRole("option", { name: "B" })).toThrow();
  });

  it("runs the chosen lump, test and setting", () => {
    const { getByRole, onRun } = renderGrid();
    fireEvent.click(getByRole("button", { name: /^run$/i }));
    // Defaults: the first untested lump and the first test, which has no setting.
    expect(onRun).toHaveBeenCalledWith("A", "water", null);
  });

  it("disables the setting dropdown for a test with no dial", () => {
    const { container } = renderGrid();
    const setting = container.querySelector(".setting-select .select");
    expect(setting).toHaveAttribute("data-disabled");
  });

  it("cannot run while a test is already running", () => {
    const { getByRole } = render(
      <TestSettings
        trial={makeEmptyTrial()}
        running={true}
        onRun={vi.fn()}
        onResetTrial={() => undefined}
      />,
    );
    expect(getByRole("button", { name: /^run$/i })).toBeDisabled();
  });

  it("says so when every lump has been spent", () => {
    let trial = makeEmptyTrial();
    for (const lump of ["A", "B", "C", "D", "E"] as const) {
      trial = applyTest(trial, lump, "water", null);
    }
    const { getByText, getByRole } = renderGrid(trial);
    expect(getByText(/no material left/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /^run$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn workspace mystery-lumps test test-settings`
Expected: FAIL — `test-settings.tsx` does not exist.

- [ ] **Step 3: Write `test-settings.tsx`**

```tsx
import { Button, Select } from "@concord-consortium/mass-sims-shared";
import { useEffect, useState } from "react";
import type { LumpId } from "../model/substances";
import { CONSUMING_TESTS, type SettingId, TESTS, type TestId } from "../model/tests";
import { type Trial, untestedLumps } from "../model/trial";

import "./test-settings.scss";

export interface TestSettingsProps {
  trial: Trial;
  running: boolean;
  onRun: (lump: LumpId, test: TestId, setting: SettingId | null) => void;
  onResetTrial: () => void;
}

/**
 * Lump, test and the test's dial, chosen the way Nor'easter chooses variables. Only the four
 * destructive tests appear here; handling and wafting live on the lumps themselves.
 */
export function TestSettings({ trial, running, onRun, onResetTrial }: TestSettingsProps) {
  const available = untestedLumps(trial);
  const [lump, setLump] = useState<LumpId | null>(available[0] ?? null);
  const [test, setTest] = useState<TestId>(CONSUMING_TESTS[0]);
  const [setting, setSetting] = useState<SettingId | null>(null);

  // A spent lump leaves the dropdown, so the selection has to move off it. Keeping this in an
  // effect rather than in the run handler means it also covers reset and trial switches.
  useEffect(() => {
    if (lump === null || !available.includes(lump)) setLump(available[0] ?? null);
  }, [available, lump]);

  const settings = TESTS[test].settings;
  // The dial only means anything for the bath and the lamp; default to the first value so Run
  // never has to cope with a test that needs a setting and hasn't got one.
  useEffect(() => {
    setSetting(settings.length > 0 ? settings[0].id : null);
  }, [settings]);

  const exhausted = available.length === 0;

  return (
    <div className="test-settings">
      <div className="settings-grid">
        <Select
          className="lump-select"
          label="Lump"
          options={available.map((id) => ({ id, label: id }))}
          selectedKey={lump}
          onSelectionChange={(id) => setLump(id as LumpId)}
          isDisabled={exhausted}
          action="lump_selected"
        />
        <Select
          className="test-select"
          label="Test"
          options={CONSUMING_TESTS.map((id) => ({ id, label: TESTS[id].label }))}
          selectedKey={test}
          onSelectionChange={(id) => setTest(id as TestId)}
          isDisabled={exhausted}
          action="test_selected"
        />
        <Select
          className="setting-select"
          label="Setting"
          options={settings.map((s) => ({ id: String(s.id), label: s.label }))}
          selectedKey={setting === null ? null : String(setting)}
          onSelectionChange={(id) => setSetting(id as SettingId)}
          isDisabled={settings.length === 0 || exhausted}
          placeholder="—"
          action="setting_selected"
        />
      </div>
      <div className="settings-actions">
        <Button
          onPress={() => lump && onRun(lump, test, setting)}
          isDisabled={running || exhausted || lump === null}
        >
          Run
        </Button>
        <Button onPress={onResetTrial} isDisabled={running}>
          Reset Trial
        </Button>
      </div>
      {exhausted ? (
        <p className="exhausted-note">
          No material left in this trial. Start a new trial to test these lumps again.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Write `test-settings.scss`**

```scss
.test-settings {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-items: end;
}

.settings-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.exhausted-note {
  margin: 0;
  text-align: center;
  font-size: 12px;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `yarn workspace mystery-lumps test test-settings`
Expected: PASS, 5 tests. If the disabled-dropdown assertion fails, inspect what
`react-aria-components` actually renders for a disabled `Select` and match the attribute it
uses — the behaviour under test is "the dial is unavailable", not the attribute's spelling.

- [ ] **Step 6: Commit**

```bash
git add simulations/mystery-lumps/src/components
git commit -m "Add the Lump / Test / Setting grid (MAS-57)"
```

---

### Task 7: The trial card and the evidence panel

**Files:**
- Create: `simulations/mystery-lumps/src/components/trial-card-body.tsx`
- Create: `simulations/mystery-lumps/src/components/evidence-panel.tsx`
- Create: `simulations/mystery-lumps/src/components/evidence-panel.scss`
- Test: `simulations/mystery-lumps/src/components/evidence-panel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyTest, makeEmptyTrial, markHandled } from "../model/trial";
import { EvidencePanel } from "./evidence-panel";

describe("EvidencePanel", () => {
  it("says nothing has been observed yet on a fresh trial", () => {
    const { getByText } = render(<EvidencePanel trial={makeEmptyTrial()} />);
    expect(getByText(/nothing observed yet/i)).toBeInTheDocument();
  });

  it("lists a handling note and a test result in full", () => {
    let trial = markHandled(makeEmptyTrial(), "B");
    trial = applyTest(trial, "B", "water", null);
    const { getByText } = render(<EvidencePanel trial={trial} />);
    // Lump B is the sea salt.
    expect(getByText(/cube-shaped crystals/i)).toBeInTheDocument();
    expect(getByText(/shrinks away to nothing/i)).toBeInTheDocument();
  });

  it("names the test and its setting alongside the observation", () => {
    const trial = applyTest(makeEmptyTrial(), "A", "bath", "80");
    const { getByText } = render(<EvidencePanel trial={trial} />);
    expect(getByText(/warm bath/i)).toBeInTheDocument();
    expect(getByText(/80 °C/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn workspace mystery-lumps test evidence-panel`
Expected: FAIL — `evidence-panel.tsx` does not exist.

- [ ] **Step 3: Write `evidence-panel.tsx`**

```tsx
import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { observe } from "../model/observe";
import { LUMP_ASSIGNMENT, LUMP_IDS } from "../model/substances";
import { type SettingId, TESTS, type TestId } from "../model/tests";
import type { Trial } from "../model/trial";

import "./evidence-panel.scss";

/** How a test and its dial read in the record: "Warm bath, 80 °C". */
function describeTest(test: TestId, setting: SettingId | null): string {
  const meta = TESTS[test];
  const option = meta.settings.find((s) => String(s.id) === String(setting));
  return option ? `${meta.label}, ${option.label}` : meta.label;
}

/**
 * Everything observed in this trial, in full prose. The sim asks for no identification, so this
 * panel is the deliverable — what a student copies onto the paper assignment.
 */
export function EvidencePanel({ trial }: { trial: Trial }) {
  const rows = LUMP_IDS.map((lump) => {
    const record = trial.lumps[lump];
    const substance = LUMP_ASSIGNMENT[lump];
    return {
      lump,
      handled: record.handled ? observe(substance, "handle", null).caption : null,
      smell: record.wafted ? observe(substance, "waft", null, record.result).caption : null,
      test: record.result ? describeTest(record.result.test, record.result.setting) : null,
      result: record.result
        ? observe(substance, record.result.test, record.result.setting).caption
        : null,
    };
  }).filter((r) => r.handled || r.smell || r.result);

  return (
    <DataSubsection title="What you've observed">
      {rows.length === 0 ? (
        <p className="evidence-empty">Nothing observed yet. Handle a lump, or run a test.</p>
      ) : (
        <ul className="evidence-list">
          {rows.map((row) => (
            <li key={row.lump}>
              <span className="evidence-lump">Lump {row.lump}</span>
              {row.handled ? <p className="evidence-note">{row.handled}</p> : null}
              {row.test ? (
                <p className="evidence-note">
                  <span className="evidence-test">{row.test}</span> — {row.result}
                </p>
              ) : null}
              {row.smell ? <p className="evidence-note">{row.smell}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </DataSubsection>
  );
}
```

- [ ] **Step 4: Write `trial-card-body.tsx`**

```tsx
import { LUMP_IDS } from "../model/substances";
import { TESTS } from "../model/tests";
import type { Trial } from "../model/trial";

/**
 * The rows inside a shared <TrialCard>: one per lump that has been given a test, listing the
 * test and its dial. Nor'easter's cards list the settings that were chosen, and these do the
 * same — the observations themselves are in the Data panel.
 */
export function TrialCardBody({ trial }: { trial: Trial }) {
  const spent = LUMP_IDS.filter((lump) => trial.lumps[lump].result !== null);
  if (spent.length === 0) return <span className="trial-card-empty">no tests yet</span>;
  return (
    <>
      {spent.map((lump) => {
        const result = trial.lumps[lump].result;
        if (!result) return null;
        const meta = TESTS[result.test];
        const option = meta.settings.find((s) => String(s.id) === String(result.setting));
        return (
          <span key={lump}>
            {lump} · {meta.label}
            {option ? ` ${option.label}` : ""}
          </span>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Write `evidence-panel.scss`**

```scss
.evidence-empty {
  margin: 0;
  font-size: 12px;
  opacity: 0.8;
}

.evidence-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;

  li + li {
    margin-top: 8px;
    border-top: 1px solid #c8d6e6;
    padding-top: 8px;
  }
}

.evidence-lump { font-weight: 700; }
.evidence-test { font-weight: 700; }
.evidence-note { margin: 2px 0 0; }
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `yarn workspace mystery-lumps test evidence-panel`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add simulations/mystery-lumps/src/components
git commit -m "Add the trial card body and the evidence panel (MAS-57)"
```

---

### Task 8: Wire it together in `app.tsx`

**Files:**
- Modify: `simulations/mystery-lumps/src/app.tsx` (replace the Starter's body wholesale)
- Delete: `simulations/mystery-lumps/src/components/simulation-view.tsx`, `simulation-view.scss`, `simulation-view.test.tsx`, `data-panel.tsx`, `data-panel.scss`, `data-panel.test.tsx`, `src/model/random-walk.ts`, `src/model/random-walk.test.ts`, `src/model/types.ts`, `src/app.test.tsx`

- [ ] **Step 1: Remove the random-walk starter code**

```bash
cd /Users/lbondaryk/Desktop/mass-sims/simulations/mystery-lumps/src
rm components/simulation-view.tsx components/simulation-view.scss components/simulation-view.test.tsx
rm components/data-panel.tsx components/data-panel.scss components/data-panel.test.tsx
rm model/random-walk.ts model/random-walk.test.ts model/types.ts
rm app.test.tsx
```

- [ ] **Step 2: Write `app.tsx`**

The trial-list, selection and AP-sync shape is the Starter's, kept deliberately close to it so
the two stay comparable. What differs: running a test is a four-second animation this component
owns, and there is no per-frame model to hoist.

```tsx
import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  SimulationFrame,
  TrialCard,
  useLogEvent,
  useReloadWarning,
} from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { EvidencePanel } from "./components/evidence-panel";
import { LumpRow } from "./components/lump-row";
import { TestSettings } from "./components/test-settings";
import { TrialCardBody } from "./components/trial-card-body";
import type { SavedState } from "./model/saved-state";
import type { LumpId } from "./model/substances";
import type { SettingId, TestId } from "./model/tests";
import {
  applyTest,
  clearTrial,
  makeEmptyTrial,
  markHandled,
  markWafted,
  type Trial,
} from "./model/trial";

import "./app.scss";

const TRIAL_LIMIT = 10; // Matches TrialCard's A–J letter cap.
/** Every test animates for the same time, whatever span it stands for. */
const RUN_MS = 4000;

export function App() {
  const [{ trials, selectedId }, setState] = useState(() => {
    const first = makeEmptyTrial();
    return { trials: [first] as Trial[], selectedId: first.id };
  });
  // The lump currently animating, or null. Deliberately not persisted: a student who reloads
  // mid-test comes back to the finished result, not to a frozen animation.
  const [runningLump, setRunningLump] = useState<LumpId | null>(null);
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logEvent = useLogEvent();

  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null;
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      setState(initMsg.interactiveState);
    }
  }, [initMsg]);
  useEffect(() => {
    setInteractiveState<SavedState>({ trials, selectedId });
  }, [trials, selectedId]);

  // Clear a pending animation on unmount so a late timer can't set state on a dead component.
  useEffect(() => () => {
    if (runTimer.current) clearTimeout(runTimer.current);
  }, []);

  const selected = trials.find((t) => t.id === selectedId) ?? trials[0];
  const anythingObserved = trials.some((t) =>
    Object.values(t.lumps).some((l) => l.result !== null || l.handled || l.wafted),
  );
  useReloadWarning(!isEmbedded && anythingObserved);

  const updateTrial = useCallback((id: string, change: (trial: Trial) => Trial) => {
    setState((prev) => ({
      ...prev,
      trials: prev.trials.map((t) => (t.id === id ? change(t) : t)),
    }));
  }, []);

  const addTrial = useCallback(() => {
    const trial = makeEmptyTrial();
    logEvent("trial_started", {});
    setState((prev) =>
      prev.trials.length >= TRIAL_LIMIT
        ? prev
        : { trials: [...prev.trials, trial], selectedId: trial.id },
    );
  }, [logEvent]);

  const selectTrial = useCallback((id: string) => {
    setState((prev) => (prev.selectedId === id ? prev : { ...prev, selectedId: id }));
  }, []);

  const resetTrial = useCallback(
    (id: string) => {
      logEvent("trial_reset", {});
      updateTrial(id, clearTrial);
    },
    [logEvent, updateTrial],
  );

  const handleLump = useCallback(
    (lump: LumpId) => {
      logEvent("lump_handled", { lump });
      updateTrial(selected.id, (t) => markHandled(t, lump));
    },
    [logEvent, selected.id, updateTrial],
  );

  const waftLump = useCallback(
    (lump: LumpId) => {
      logEvent("lump_wafted", { lump });
      updateTrial(selected.id, (t) => markWafted(t, lump));
    },
    [logEvent, selected.id, updateTrial],
  );

  // The result is committed up front and the animation is only a delay before the student may
  // act again, so a reload mid-run loses nothing.
  const runTest = useCallback(
    (lump: LumpId, test: TestId, setting: SettingId | null) => {
      logEvent("test_run", { lump, test, setting: String(setting) });
      updateTrial(selected.id, (t) => applyTest(t, lump, test, setting));
      setRunningLump(lump);
      if (runTimer.current) clearTimeout(runTimer.current);
      runTimer.current = setTimeout(() => setRunningLump(null), RUN_MS);
    },
    [logEvent, selected.id, updateTrial],
  );

  return (
    <SimulationFrame
      simTitle="Mystery Lumps"
      tagline="Five white lumps washed up on a beach. What are they?"
      infoModalContent={
        <p>
          Five lumps were collected from a beach. Each one has enough material for a single
          test, so choose carefully — but you can look at them and smell them as often as you
          like. Record what you observe; the simulation will not tell you what anything is.
        </p>
      }
    >
      <SimulationFrame.Trials>
        {trials.map((trial, i) => (
          <TrialCard
            key={trial.id}
            index={i}
            selected={trial.id === selectedId}
            onSelect={() => selectTrial(trial.id)}
            onReset={() => resetTrial(trial.id)}
          >
            <TrialCardBody trial={trial} />
          </TrialCard>
        ))}
        {trials.length < TRIAL_LIMIT ? (
          <button
            type="button"
            className="new-trial-card"
            aria-label="New trial"
            onClick={addTrial}
          >
            <span className="new-trial-icon" aria-hidden="true">
              +
            </span>
            New
          </button>
        ) : null}
      </SimulationFrame.Trials>

      <SimulationFrame.Simulation instruction="Each lump has enough for one test — handling is free">
        <TestSettings
          trial={selected}
          running={runningLump !== null}
          onRun={runTest}
          onResetTrial={() => resetTrial(selected.id)}
        />
        <LumpRow
          trial={selected}
          runningLump={runningLump}
          onHandle={handleLump}
          onWaft={waftLump}
        />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <EvidencePanel trial={selected} />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
```

- [ ] **Step 3: Replace `app.scss` with the sim's own**

```scss
@use "@concord-consortium/mass-sims-shared/src/styles/tokens.scss" as *;

.new-trial-card {
  width: 100%;
  background: #fff;
  border: 2px solid #4a7fc1;
  border-radius: 8px;
  padding: 7px;
  cursor: pointer;
  font-weight: 700;
}

.new-trial-icon {
  display: block;
  font-size: 18px;
}

.trial-card-empty {
  opacity: 0.7;
}
```

If the Starter's `app.scss` already carries `.new-trial-card` rules, keep them rather than
duplicating — check before writing.

- [ ] **Step 4: Typecheck, test, lint, build**

Run:
```bash
cd /Users/lbondaryk/Desktop/mass-sims
yarn workspace mystery-lumps typecheck
yarn workspace mystery-lumps test
yarn lint
yarn workspace mystery-lumps build
```
Expected: all pass, with no reference left to `random-walk`, `SimInput`, `SimOutput` or
`SimTransient`.

- [ ] **Step 5: Look at it**

Run: `yarn workspace mystery-lumps dev`

Walk the whole thing: handle all five lumps and confirm B reads as crystals while the other
four fall into two identical-sounding pairs; put a lump in vinegar and look for the fizz on E;
bathe A at 40 (nothing) and at 60 (softens); hold D under the lamp for two weeks and then waft
it; confirm a spent lump leaves the Lump dropdown but keeps working Handle and Waft buttons;
press New and confirm the previous card stays.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Wire Mystery Lumps together (MAS-57)"
```

---

## Self-review against the spec

**Covered:** the fixed assignment (Task 2), every observation and threshold including the
no-glow decision (Task 3), the dropdown settings (Task 2/6), waft-after-lamp-only (Task 3), the
free actions on the lumps (Task 5), one destructive test per lump (Task 4/6), New and Reset
Trial (Task 8), the stage doubling as the tray with end states retained (Task 5), the Data
panel as the deliverable (Task 7), saved state without captions (Task 4), the five log events
(Tasks 6/8), and the Nor'easter-ish chrome as a rough first pass (Tasks 5–8).

**Two spec items deliberately deferred, both cosmetic rather than structural:**

- The **"copy for my write-up" affordance** in the Data panel. The record it would copy is
  rendered and correct; the copy button is worth adding once the wording has settled, since it
  would otherwise be rewritten alongside it.
- The **elapsed-time caption** ("30 seconds", "two weeks under the lamp") is returned by
  `observe()` and tested, but no component displays it yet — it belongs with the per-apparatus
  art rather than with the placeholder coloured blocks.

Both are listed here rather than hidden so the first review can decide whether they should
land in this pass.
