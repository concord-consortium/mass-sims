# SimulationFrame Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `<SimulationFrame>` and `<Section>` as structurally-correct, token-driven skeletons that implement the stable §3 API contract exactly, plus a non-deployed preview workspace that renders the frame at all four target widths × 562 px — deferring every still-open visual decision to `tokens.scss`.

**Architecture:** `<SimulationFrame>` is a compound component (named slots `Trials` / `Simulation` / `Data`) that lays out a CSS-Grid shell with two header rows (project bar + sub-header) and a three-column body. Each slot wraps its children in the shared `<Section>` component and is placed into a fixed grid-area via a class name, so slots render in the correct region regardless of source order. The info-modal is a self-contained controlled overlay inside the frame. Every dimension, color, radius, and spacing value comes from `tokens.scss` — when designs land, changes happen there, not in component files. A `packages/sim-frame-preview` workspace renders the frame at 1044/1024/989/676 × 562 for fast visual iteration; because CI deploys and indexes only `simulations/*`, this `packages/*` workspace is automatically excluded from deploys and the landing page.

**Tech Stack:** React 19.2, TypeScript 6, Vite 8, Vitest 4 + @testing-library/react (jsdom), plain (global) SCSS via side-effect imports scoped under a root class (house convention; typed via `vite/client`), `clsx` for class composition, Biome (lint/format).

---

## Conventions discovered in the codebase (follow these exactly)

These were verified by reading the existing code. Honoring them keeps the diff idiomatic.

- **Tests import from `"vitest"` explicitly** — `globals: false` is set in every `vitest.config.ts`. Never rely on injected globals.
- **`@testing-library/jest-dom` is added in Task 1** (matchers like `toBeInTheDocument()`, `toHaveAttribute()`, `toHaveClass()`, `not.toBeInTheDocument()`). It is registered via a per-workspace `test-setup.ts` referenced from `vitest.config.ts` `setupFiles`; the same file's import provides the type augmentation so the matchers typecheck. Workspaces that run component tests (`packages/shared`, `packages/sim-frame-preview`) each get this wiring.
- **`@testing-library/user-event` is NOT installed.** Use `fireEvent` (re-exported from `@testing-library/react`) for clicks and `fireEvent.keyDown(el, { key: "Escape" })` for Esc.
- **Component styles are plain (global) SCSS imported for side-effect** — `import "./section.scss";`, NOT `import styles from "./section.module.scss"`. This matches the house convention (dese-models: 448 plain `.scss`, zero CSS Modules). JSX uses plain string class names composed with `clsx`. To avoid leaking generic names (`.content`, `.title`) into the global scope, **scope every component's rules under a single root class** (`.section { .chip { … } }`) — exactly the dese-models pattern. Do NOT use `*.module.scss` or the `styles.x` mapping object.
- **`css: false` in Vitest** ignores the side-effect `.scss` import entirely — there is no `styles` object. Assert on roles / text / ARIA, and on plain-string class names that the component actually sets (`toHaveClass("section")`, `toHaveClass("external-area")`).
- **`clsx` is added in Task 1** as a `packages/shared` runtime dependency, used to join class names in shared components.
- **Side-effect `*.scss` imports are typed by `vite/client`.** Sims/starter already set `"types": ["vite/client"]`; Task 1 adds it to `packages/shared`. No custom `*.d.ts` is needed.
- **Tokens are accessed via `@use "tokens"`** from a relative path inside component SCSS, namespaced as `tokens.$foo`. Nothing outside `tokens.scss` hard-codes color/size/spacing/radius.
- **The shared barrel** is `packages/shared/src/index.ts`; new components are exported there (the `"."` package export already points at it). No `package.json` `exports` edits needed for components.
- **Biome formatting:** double quotes, semicolons, trailing commas "all", 2-space indent, 100-char lines, `always` arrow parens. Run `yarn lint:fix` before committing if unsure.

---

## Scope guardrails (what this plan deliberately does NOT do)

Per the agreed strategy ("build the structure, defer the detail"):

- **No narrow-mode (676 px) collapse behavior.** Wide-mode 3-column grid only. The 676 preview panel will visibly overflow — that is the expected, documented signal that narrow mode is still owed (Q30). A `layout` seam is noted but not built.
- **No committed visual treatment** for Section (final background, shadow, border, chip gradient, chip typography, padding scale) — a 1px placeholder border + `$radius-section` + `$space-4` padding only.
- **No committed slot proportions** — wire the existing `$column-trials-*` / `$column-data-*` draft tokens through; do not change their values.
- **No focus-trap library.** The info modal gets correct ARIA + Esc + a close button + initial focus, but full focus-trapping is deferred to the future shared `Dialog` component (infra plan §6 / components list). Leave a `// TODO` noting this.
- **No `useModelState` / runner / logging / iframe-phone wiring** — those are Phase 2.

---

## Task 0: Branch and confirm a green baseline

**Files:** none (git + verification only).

**Step 1: Create a feature branch**

The working tree is clean on `main`. Do not commit skeleton work to `main`.

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
git checkout -b feature/simulation-frame-skeleton
```

**Step 2: Confirm the existing suite is green before changing anything**

```bash
yarn typecheck && yarn lint && yarn test
```

Expected: all pass (Phase 1 hooks/utils tests green, Biome clean, every `tsc --noEmit` clean). If anything fails here, STOP and report — it is a pre-existing failure, not caused by this work.

---

## Task 1: Foundation — deps, jest-dom wiring, vite/client `.scss` typing, header-chrome tokens

This unblocks every later task. Independent foundation changes.

**Files:**
- Modify: `packages/shared/package.json` (via `yarn add`)
- Create: `packages/shared/src/test-setup.ts`
- Modify: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/tsconfig.json`
- Modify: `packages/shared/src/styles/tokens.scss`

**Step 1: Install `clsx` (runtime) and `@testing-library/jest-dom` (dev) in shared**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
yarn workspace @concord-consortium/mass-sims-shared add clsx
yarn workspace @concord-consortium/mass-sims-shared add -D @testing-library/jest-dom
```

Expected: `clsx` lands in `dependencies` (alongside `seedrandom`); `@testing-library/jest-dom` lands in `devDependencies`. `yarn.lock` updates.

**Step 2: Create the jest-dom test setup file**

Create `packages/shared/src/test-setup.ts`. It registers jest-dom AND an explicit `afterEach(cleanup)` — required because `globals: false` disables Testing Library's automatic cleanup, so without it the DOM accumulates across the component tests added in later tasks:

```ts
// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, …)
// on Vitest's expect, and — because this file is in the tsconfig include — provides the
// global type augmentation so those matchers typecheck in *.test.tsx files.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, Testing Library does not auto-register its `afterEach(cleanup)`
// (it only does so when it detects injected test-runner globals). Without this, rendered
// DOM accumulates across tests and queries like `getByRole` match elements from prior
// tests. Register cleanup explicitly so each test starts from a clean document.
afterEach(() => {
  cleanup();
});
```

**Step 3: Wire the setup file into the shared Vitest config**

In `packages/shared/vitest.config.ts`, add `setupFiles` to the `test` block (keep `globals: false` and `css: false`):

```ts
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    setupFiles: ["./src/test-setup.ts"],
  },
```

**Step 4: Add `vite/client` ambient types to the shared package**

Without this, `tsc --noEmit` in `packages/shared` fails the moment a component does a side-effect `import "./x.scss"` (TS needs the ambient `declare module "*.scss"` that `vite/client` provides). The sims already set this; shared just never needed it until now.

In `packages/shared/tsconfig.json`, add `"types": ["vite/client"]` to `compilerOptions` (mirroring `simulations/sim-one/tsconfig.json`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "noEmit": true,
    // Restricts ambient types to vite/client, which declares the side-effect `*.scss` (and
    // asset) module imports components use (e.g. `import "./section.scss"`). Note: an explicit
    // list opts OUT of auto-including other @types/* — add them here if needed (e.g. "node").
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 5: Add draft header-chrome height tokens**

The frame's project bar (~40 px) and sim sub-header (~48 px) are called out in ui-design-plan.md §9. They must not be hard-coded in the component SCSS. Append to the `LAYOUT DIMENSIONS` block in `packages/shared/src/styles/tokens.scss` (right after the column-proportion tokens, before the `CORNER RADII` section):

```scss
// Frame header chrome heights (draft; ui-design-plan.md §9 — designer will tune).
// Suppression of these rows when embedded in Activity Player is deferred (Q31).
$frame-projectbar-height:    40px;
$frame-subheader-height:     48px;
```

**Step 6: Verify shared still typechecks, lints, and tests pass**

```bash
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared test
```

Expected: all pass (no behavior change yet; just deps + config + new variables; the existing hook/util tests still run green through the new `setupFiles`).

**Step 7: Commit**

```bash
git add packages/shared/package.json packages/shared/vitest.config.ts \
  packages/shared/src/test-setup.ts packages/shared/tsconfig.json \
  packages/shared/src/styles/tokens.scss ../../yarn.lock
git commit -m "chore(shared): add clsx + jest-dom, vite/client scss typing, frame chrome tokens"
```

> The `yarn.lock` is at the repo root; adjust the path if your shell isn't in `packages/shared`. Simplest: run `git add -A` from the repo root after reviewing `git status`.

---

## Task 2: `<Section>` skeleton (TDD)

The labeled-region primitive used by all three frame slots and by sims inside the Data slot.

**Files:**
- Create: `packages/shared/src/components/section/section.tsx`
- Create: `packages/shared/src/components/section/section.scss`
- Create: `packages/shared/src/components/section/section.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/components/section/section.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Section } from "./section";

describe("Section", () => {
  it("renders its children", () => {
    const { getByText } = render(<Section title="Trials">trial content</Section>);
    expect(getByText("trial content")).toBeInTheDocument();
  });

  it("renders the title as a heading", () => {
    const { getByRole } = render(<Section title="Data">body</Section>);
    expect(getByRole("heading", { name: "Data" })).toBeInTheDocument();
  });

  it("labels the region via aria-labelledby pointing at the title", () => {
    const { getByRole } = render(<Section title="Simulation">viz</Section>);
    // A <section> with an accessible name is exposed as a 'region' landmark.
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
  });

  it("wires the heading to the region with a generated id", () => {
    const { getByRole } = render(<Section title="Viz">body</Section>);
    const region = getByRole("region", { name: "Viz" });
    const heading = getByRole("heading", { name: "Viz" });
    expect(heading.id).toBeTruthy();
    expect(region.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("keeps the region's accessible name to just the title when an instruction is present", () => {
    const { getByRole, getByText } = render(
      <Section title="Simulation" instruction="Select two parents to begin">
        viz
      </Section>,
    );
    // The instruction is supplementary: it renders, but must NOT widen the landmark name.
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Simulation" })).toBeInTheDocument();
    expect(getByText("Select two parents to begin")).toBeInTheDocument();
  });

  it("renders adjacent instruction text when provided", () => {
    const { getByText } = render(
      <Section title="Simulation" instruction="Select two parents to begin">
        viz
      </Section>,
    );
    expect(getByText("Select two parents to begin")).toBeInTheDocument();
  });

  it("merges an external className onto the root region", () => {
    const { getByRole } = render(
      <Section title="Trials" className="external-area">
        body
      </Section>,
    );
    // Under `css: false` no styles are applied, but the plain class-name strings are still
    // on the element (both `section` and the external `external-area`), so `toHaveClass`
    // works — and the external class is exactly what a slot uses to assign a grid-area.
    expect(getByRole("region", { name: "Trials" })).toHaveClass("external-area");
  });
});
```

**Step 2: Run the test to verify it fails**

```bash
yarn workspace @concord-consortium/mass-sims-shared test section
```

Expected: FAIL — `Cannot find module './section'`.

**Step 3: Write the SCSS**

Create `packages/shared/src/components/section/section.scss` — plain (global) SCSS, side-effect imported, with everything nested under the `.section` root class (house convention). Placeholder visual only — radius + padding from tokens, 1px border as a throwaway:

```scss
@use "../../styles/tokens" as tokens;

// Plain (global) SCSS scoped under a single `.section` root class (dese-models convention).
// Children are nested so selectors stay `.section .chip` etc. and generic names don't leak.
//
// VISUAL TREATMENT IS A PLACEHOLDER. Final chip styling, background, shadow, and padding
// scale arrive via tokens.scss when designs land.
.section {
  display: flex;
  flex-direction: column;
  min-height: 0; // allow the body to scroll inside a grid track
  border: 1px solid tokens.$color-border; // PLACEHOLDER — designer will replace
  border-radius: tokens.$radius-section;
  background: tokens.$color-surface;
  box-sizing: border-box;

  // Title chip: flex container holding the heading and the optional instruction as siblings.
  .chip {
    display: flex;
    align-items: baseline;
    gap: tokens.$space-2;
    padding: tokens.$space-2 tokens.$space-3;
  }

  .title {
    margin: 0;
    font-family: tokens.$font-family-condensed;
    font-size: tokens.$font-size-sm;
    font-weight: 700;
    color: tokens.$color-text;
  }

  .instruction {
    font-weight: 400;
    font-size: tokens.$font-size-xs;
    color: tokens.$color-text-muted;
  }

  .content {
    flex: 1 1 auto;
    min-height: 0;
    padding: tokens.$space-4;
    overflow: auto; // regions scroll; the frame opts specific slots in/out via wrappers
  }
}
```

**Step 4: Write the minimal component**

Create `packages/shared/src/components/section/section.tsx`:

```tsx
import clsx from "clsx";
import { type ReactNode, useId } from "react";
import "./section.scss";

export interface SectionProps {
  children?: ReactNode;
  /** Extra class on the root region — the frame uses this to assign a grid-area. */
  className?: string;
  /** Optional supplementary text rendered beside the title (e.g. a Simulation instruction). */
  instruction?: ReactNode;
  /** Region label, shown in the title chip and used as the region's accessible name. */
  title: string;
}

/**
 * Labeled, rounded region used by all three SimulationFrame slots and by sims that add
 * sub-sections inside the Data slot. The title chip is a real heading element so screen
 * readers announce it and `aria-labelledby` exposes the section as a named region.
 *
 * VISUAL TREATMENT IS A PLACEHOLDER (see docs/simulation-frame-plan.md). Final chip
 * styling, background, shadow, and padding scale arrive via tokens.scss when designs land.
 */
export function Section({ title, instruction, className, children }: SectionProps) {
  const titleId = useId();
  return (
    <section className={clsx("section", className)} aria-labelledby={titleId}>
      <div className="chip">
        {/* Heading is fixed at <h2>. Sub-sections nested inside the Data slot currently also
            render <h2> under the Data region's own <h2> (flat heading outline). A configurable
            heading level (<h3> for sub-sections) is deferred to the Data sub-section variant —
            an a11y/heading-hierarchy concern, see docs/simulation-frame-plan.md deferred list. */}
        <h2 id={titleId} className="title">
          {title}
        </h2>
        {/* Outside the <h2> on purpose: the instruction is supplementary and must not
            fold into the heading / region accessible name (which stays just `title`). */}
        {instruction ? <div className="instruction">{instruction}</div> : null}
      </div>
      <div className="content">{children}</div>
    </section>
  );
}
```

Note on the generated id: jsdom only exposes a `<section>` as a named `region` landmark when it has an explicit `aria-labelledby` — it does NOT infer the name from a contained heading. So the title id is always set (a per-instance `useId()`), and both `<h2 id>` and `aria-labelledby` point at it. Using `useId()` rather than a caller-supplied id guarantees uniqueness even when several Sections (or several frames) render on one page. The `instruction` sits OUTSIDE the `<h2>` so it never folds into the heading/region accessible name. (Tests lock both invariants in — see the test file.)

**Step 5: Export from the barrel**

In `packages/shared/src/index.ts`, add a `Components` section (above `// Hooks` or below `// Utils`):

```ts
// Components
export { Section, type SectionProps } from "./components/section/section";
```

**Step 6: Run the tests to verify they pass**

```bash
yarn workspace @concord-consortium/mass-sims-shared test section
```

Expected: PASS (all 7).

**Step 7: Typecheck, lint, commit**

```bash
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
git add packages/shared/src/components/section packages/shared/src/index.ts
git commit -m "feat(shared): add Section labeled-region skeleton"
```

---

## Task 3: `<SimulationFrame>` compound component — header + slots + grid (TDD)

Implements the §3 API: four header props, three named slots, wide-mode grid. The info modal is added separately in Task 4.

**Files:**
- Create: `packages/shared/src/components/simulation-frame/simulation-frame.tsx`
- Create: `packages/shared/src/components/simulation-frame/simulation-frame.scss`
- Create: `packages/shared/src/components/simulation-frame/simulation-frame.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/components/simulation-frame/simulation-frame.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulationFrame } from "./simulation-frame";

function renderFrame(extra?: Partial<{ instruction: string }>) {
  return render(
    <SimulationFrame projectName="Mass Sims" simTitle="Bananas" tagline="A short description">
      <SimulationFrame.Trials>
        <div>trial-row</div>
      </SimulationFrame.Trials>
      <SimulationFrame.Simulation instruction={extra?.instruction}>
        <div>sim-viz</div>
      </SimulationFrame.Simulation>
      <SimulationFrame.Data>
        <div>data-content</div>
      </SimulationFrame.Data>
    </SimulationFrame>,
  );
}

describe("SimulationFrame", () => {
  it("renders the four header props", () => {
    const { getByText } = renderFrame();
    expect(getByText("Mass Sims")).toBeInTheDocument();
    expect(getByText("Bananas")).toBeInTheDocument();
    expect(getByText("A short description")).toBeInTheDocument();
  });

  it("renders each slot's children inside a titled region", () => {
    const { getByRole, getByText } = renderFrame();
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
    expect(getByText("trial-row")).toBeInTheDocument();
    expect(getByText("sim-viz")).toBeInTheDocument();
    expect(getByText("data-content")).toBeInTheDocument();
  });

  it("forwards the Simulation instruction to its section", () => {
    const { getByText } = renderFrame({ instruction: "Select two parents to begin" });
    expect(getByText("Select two parents to begin")).toBeInTheDocument();
  });

  it("gives region headings unique ids across multiple frames in one document", () => {
    const oneFrame = (key: string) => (
      <SimulationFrame key={key} projectName="P" simTitle={key} tagline="t">
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>
    );
    const { container } = render(
      <>
        {oneFrame("A")}
        {oneFrame("B")}
      </>,
    );
    const headingIds = Array.from(container.querySelectorAll("h2")).map((h) => h.id);
    // Six region headings (3 per frame), every one non-empty and unique — so the
    // aria-labelledby targets never collide when frames share a document.
    expect(headingIds).toHaveLength(6);
    expect(headingIds.every((id) => id.length > 0)).toBe(true);
    expect(new Set(headingIds).size).toBe(headingIds.length);
  });

  it("uses canonical slot titles by default", () => {
    const { getByRole } = renderFrame();
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });

  it("lets a sim override each slot's visible title", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame projectName="P" simTitle="Bananas" tagline="t">
        <SimulationFrame.Trials title="Crosses">
          <div>tr</div>
        </SimulationFrame.Trials>
        <SimulationFrame.Simulation title="Lab" instruction="Select two parents to begin">
          <div>st</div>
        </SimulationFrame.Simulation>
        <SimulationFrame.Data title="Results">
          <div>d</div>
        </SimulationFrame.Data>
      </SimulationFrame>,
    );
    // Custom labels are exposed as the regions' accessible names.
    expect(getByRole("region", { name: "Crosses" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Lab" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Results" })).toBeInTheDocument();
    // Default labels no longer apply when overrides are passed.
    expect(queryByRole("region", { name: "Trials" })).not.toBeInTheDocument();
    expect(queryByRole("region", { name: "Simulation" })).not.toBeInTheDocument();
    expect(queryByRole("region", { name: "Data" })).not.toBeInTheDocument();
  });

  it("places slots in Trials/Simulation/Data order regardless of source order", () => {
    const { getByRole } = render(
      <SimulationFrame projectName="P" simTitle="S" tagline="t">
        <SimulationFrame.Data>
          <div>d</div>
        </SimulationFrame.Data>
        <SimulationFrame.Trials>
          <div>tr</div>
        </SimulationFrame.Trials>
        <SimulationFrame.Simulation>
          <div>st</div>
        </SimulationFrame.Simulation>
      </SimulationFrame>,
    );
    // All three regions still resolve, proving order-independence of the slot API.
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

```bash
yarn workspace @concord-consortium/mass-sims-shared test simulation-frame
```

Expected: FAIL — `Cannot find module './simulation-frame'`.

**Step 3: Write the SCSS**

Create `packages/shared/src/components/simulation-frame/simulation-frame.scss` — plain (global) SCSS, side-effect imported, everything nested under the `.simulation-frame` root class (house convention; a descriptive root name, not a generic one like `.frame`). Wide-mode grid only; all dimensions from tokens:

```scss
@use "../../styles/tokens" as tokens;

.simulation-frame {
  display: grid;
  width: 100%;
  height: tokens.$frame-height;
  box-sizing: border-box;
  grid-template-columns:
    minmax(tokens.$column-trials-min-width, tokens.$column-trials-max-width)
    minmax(0, 1fr)
    minmax(tokens.$column-data-min-width, tokens.$column-data-max-width);
  grid-template-rows: tokens.$frame-projectbar-height tokens.$frame-subheader-height 1fr;
  grid-template-areas:
    "projectbar projectbar projectbar"
    "subheader  subheader  subheader"
    "trials     simulation data";
  gap: tokens.$space-2;
  padding: tokens.$space-2;
  font-family: tokens.$font-family-base;
  color: tokens.$color-text;
  background: tokens.$color-surface-muted; // PLACEHOLDER backdrop

  .project-bar {
    grid-area: projectbar;
    display: flex;
    align-items: center;
    font-weight: 700;
  }

  .sub-header {
    grid-area: subheader;
    display: flex;
    align-items: center;
    gap: tokens.$space-3;
  }

  .sim-title {
    margin: 0;
    font-size: tokens.$font-size-xl;
  }

  .tagline {
    color: tokens.$color-text-muted;
    font-size: tokens.$font-size-sm;
  }

  // Grid-area assignments applied to each slot's Section root (a direct child) via className.
  .trials-area {
    grid-area: trials;
  }
  .simulation-area {
    grid-area: simulation;

    // §10: the Simulation region does not scroll — a sim that outgrows its column is
    // responsible for compacting (ui-design-plan.md §10). Override Section's default
    // `overflow: auto` on the region's content. Trials and Data keep the scrolling default.
    .content {
      overflow: hidden;
    }
  }
  .data-area {
    grid-area: data;
  }
}
```

**Step 4: Write the component (header + slots; modal placeholder comes in Task 4)**

Create `packages/shared/src/components/simulation-frame/simulation-frame.tsx`:

```tsx
import type { ReactNode } from "react";
import { Section } from "../section/section";
import "./simulation-frame.scss";

export interface SimulationFrameProps {
  /** Slot elements: SimulationFrame.Trials / .Simulation / .Data. */
  children?: ReactNode;
  /** Content for the info modal (rendered when the About button is activated). */
  infoModalContent?: ReactNode;
  /** Project-wide name shown in the top project bar. */
  projectName: string;
  /** This simulation's title, shown in the sub-header. */
  simTitle: string;
  /** Short description / tagline shown beside the title. */
  tagline: string;
}

interface SlotProps {
  children?: ReactNode;
  title?: string;
}
interface SimulationSlotProps extends SlotProps {
  /** Optional instruction shown beside the Simulation section title. */
  instruction?: ReactNode;
}

// Slot components render their children into the correct grid-area-tagged Section.
// They render directly (no Context/Children gymnastics): grid-area placement makes the
// visual order independent of source order, which keeps the slot API order-tolerant.
// The grid-area class (e.g. "trials-area") is passed to Section's className; Section
// composes it with its own root class as clsx("section", className).
// No explicit `id` is passed to Section: it falls back to a per-instance `useId()`, so each
// frame's region headings get unique ids. Passing a fixed id (e.g. "trials") would produce
// duplicate `trials-title` ids when more than one frame renders in the same document.
function Trials({ children, title = "Trials" }: SlotProps) {
  return (
    <Section title={title} className="trials-area">
      {children}
    </Section>
  );
}

function Simulation({ children, instruction, title = "Simulation" }: SimulationSlotProps) {
  return (
    <Section title={title} instruction={instruction} className="simulation-area">
      {children}
    </Section>
  );
}

function Data({ children, title = "Data" }: SlotProps) {
  return (
    <Section title={title} className="data-area">
      {children}
    </Section>
  );
}

/**
 * Three-region simulation shell implementing the §3 API contract (infrastructure-plan.md).
 * STRUCTURE ONLY — wide-mode grid; visual specifics live in tokens.scss. Narrow mode (676 px)
 * collapse behavior is deferred (ui-design-plan.md §8/Q30).
 */
export function SimulationFrame({
  projectName,
  simTitle,
  tagline,
  children,
}: SimulationFrameProps) {
  // `infoModalContent` is intentionally omitted from the destructure until Task 4 wires the modal.
  return (
    <div className="simulation-frame">
      <div className="project-bar">{projectName}</div>
      <header className="sub-header">
        <h1 className="sim-title">{simTitle}</h1>
        <span className="tagline">{tagline}</span>
      </header>
      {children}
    </div>
  );
}

SimulationFrame.Trials = Trials;
SimulationFrame.Simulation = Simulation;
SimulationFrame.Data = Data;
```

> `infoModalContent` is declared in `SimulationFrameProps` but intentionally NOT destructured/rendered in Task 3 — both TS `noUnusedLocals` and Biome flag an unused destructured binding, so it's left out until Task 4 adds the About button + modal that consume it.

**Step 5: Export from the barrel**

In `packages/shared/src/index.ts`, under `// Components`:

```ts
export {
  SimulationFrame,
  type SimulationFrameProps,
} from "./components/simulation-frame/simulation-frame";
```

**Step 6: Run the tests to verify they pass**

```bash
yarn workspace @concord-consortium/mass-sims-shared test simulation-frame
```

Expected: PASS (all 7).

**Step 7: Typecheck, lint, commit**

```bash
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
git add packages/shared/src/components/simulation-frame packages/shared/src/index.ts
git commit -m "feat(shared): add SimulationFrame compound skeleton (header + slots + grid)"
```

---

## Task 4: Info modal (TDD)

Adds the About button to the sub-header and a controlled, accessible modal. Minimal, correct ARIA + Esc + close button + initial focus. Full focus-trapping deferred to the future shared `Dialog`.

**Files:**
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.tsx`
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.scss`
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.test.tsx`

**Step 1: Add the failing tests**

Append to the existing `describe("SimulationFrame", ...)` block in `simulation-frame.test.tsx`:

```tsx
import { fireEvent } from "@testing-library/react";

// ... inside describe("SimulationFrame", () => { ... }) ...

it("shows an About button but no modal initially", () => {
  const { getByRole, queryByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about this sim</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  expect(getByRole("button", { name: /about/i })).toBeInTheDocument();
  expect(queryByRole("dialog")).not.toBeInTheDocument();
});

it("opens the modal with the info content when the About button is clicked", () => {
  const { getByRole, getByText } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about this sim</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  fireEvent.click(getByRole("button", { name: /about/i }));
  expect(getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  expect(getByText("about this sim")).toBeInTheDocument();
});

it("titles the modal contextually from simTitle", () => {
  const { getByRole } = render(
    <SimulationFrame projectName="P" simTitle="Bananas" tagline="t" infoModalContent={<p>x</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  fireEvent.click(getByRole("button", { name: /about/i }));
  // The dialog's accessible name comes from its heading, derived from simTitle.
  expect(getByRole("heading", { name: "About the Bananas Simulation" })).toBeInTheDocument();
  expect(getByRole("dialog", { name: "About the Bananas Simulation" })).toBeInTheDocument();
});

it("closes the modal via the close button", () => {
  const { getByRole, queryByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  fireEvent.click(getByRole("button", { name: /about/i }));
  fireEvent.click(getByRole("button", { name: /close/i }));
  expect(queryByRole("dialog")).not.toBeInTheDocument();
});

it("portals the modal outside the .simulation-frame element (to document.body)", () => {
  const { container, getByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  fireEvent.click(getByRole("button", { name: /about/i }));
  const frame = container.querySelector(".simulation-frame");
  const dialog = getByRole("dialog");
  // The dialog must NOT be a descendant of the frame (otherwise a `position: fixed`
  // ancestor with a transform/filter/contain could trap it), but must be in the document.
  expect(frame?.contains(dialog)).toBe(false);
  expect(document.body.contains(dialog)).toBe(true);
});

it("does not move focus to the About button on initial render", () => {
  const { getByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  // The close-state focus-restore must NOT fire on mount (the `wasOpenRef` guard) —
  // otherwise every frame would steal focus to its About button on page load.
  expect(getByRole("button", { name: /about/i })).not.toHaveFocus();
});

it("returns focus to the About button when the modal closes", () => {
  const { getByRole, queryByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  const aboutButton = getByRole("button", { name: /about/i });
  fireEvent.click(aboutButton);
  fireEvent.click(getByRole("button", { name: /close/i }));
  expect(queryByRole("dialog")).not.toBeInTheDocument();
  // Focus returns to the element that opened the modal — standard dialog etiquette.
  expect(aboutButton).toHaveFocus();
});

it("moves focus to the close button on open and closes on Escape from there", () => {
  const { getByRole, queryByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  fireEvent.click(getByRole("button", { name: /about/i }));
  // Focus moves to the close button on open; Escape dispatched from there must bubble to
  // the dialog's onKeyDown and close it — mirroring the real keyboard path.
  const closeButton = getByRole("button", { name: /close/i });
  expect(closeButton).toHaveFocus();
  fireEvent.keyDown(closeButton, { key: "Escape" });
  expect(queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not render an About button when no infoModalContent prop is given", () => {
  const { queryByRole } = render(
    <SimulationFrame projectName="P" simTitle="S" tagline="t">
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  expect(queryByRole("button", { name: /about/i })).not.toBeInTheDocument();
});
```

**Step 2: Run to verify the new tests fail**

```bash
yarn workspace @concord-consortium/mass-sims-shared test simulation-frame
```

Expected: the new modal-behavior tests FAIL (no About button / dialog yet); the earlier tests — and the one asserting the button is absent when `infoModalContent` is omitted — still pass.

**Step 3: Add the modal styles**

Add `.info-button` **inside** the `.simulation-frame { … }` block (it lives in the header, so it stays scoped under the frame root):

```scss
  .info-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto; // push the button to the right edge of the sub-header
    min-width: tokens.$touch-target-min;
    min-height: tokens.$touch-target-min;
    border: 1px solid tokens.$color-border;
    border-radius: tokens.$radius-sm;
    background: tokens.$color-surface;
    cursor: pointer;
  }
```

The modal is **portaled to `<body>`** (Step 4), so it is NOT a DOM descendant of `.simulation-frame` — its styles must live at the **top level** under a namespaced root class, NOT nested under the frame root (otherwise the portaled node matches nothing and renders unstyled):

```scss
// The info modal is portaled to <body> so a `position: fixed` ancestor with a transform /
// filter / contain / will-change can't trap it. Styles live top-level under a namespaced root.
.simulation-frame-info-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(tokens.$black, 0.4); // PLACEHOLDER scrim
  z-index: 1000;

  .modal {
    max-width: 480px;
    max-height: 80%;
    overflow: auto;
    padding: tokens.$space-5;
    border-radius: tokens.$radius-section;
    background: tokens.$color-surface;
    box-sizing: border-box;
  }

  .modal-close {
    min-width: tokens.$touch-target-min;
    min-height: tokens.$touch-target-min;
  }
}
```

**Step 4: Implement the modal in the component**

Update the imports at the top of `simulation-frame.tsx` to add the React hooks and `createPortal` (keep the `Section` and side-effect `.scss` imports — Biome's import organizer will order these):

```tsx
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Section } from "../section/section";
import "./simulation-frame.scss";
```

Inside `SimulationFrame`, replace the body with the version that wires `infoModalContent`:

```tsx
export function SimulationFrame({
  projectName,
  simTitle,
  tagline,
  infoModalContent,
  children,
}: SimulationFrameProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();

  // Focus management: move focus to the close button on open, and return it to the info
  // button (the trigger) on close — standard dialog etiquette so keyboard users aren't
  // stranded. The `wasOpenRef` guard ensures we only restore focus on a real open→close
  // transition, never on the initial render (when `infoOpen` already starts false).
  // Full focus-trapping (Tab cycling within the modal) is still deferred to the shared
  // Dialog component — TODO Phase 2/3.
  useEffect(() => {
    if (infoOpen) {
      wasOpenRef.current = true;
      closeRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [infoOpen]);

  return (
    <div className="simulation-frame">
      <div className="project-bar">{projectName}</div>
      <header className="sub-header">
        <h1 className="sim-title">{simTitle}</h1>
        <span className="tagline">{tagline}</span>
        {infoModalContent ? (
          // Visible "About" text IS the accessible name — no aria-label (which would
          // override it and trip WCAG 2.5.3 Label in Name).
          <button
            ref={triggerRef}
            type="button"
            className="info-button"
            aria-haspopup="dialog"
            onClick={() => setInfoOpen(true)}
          >
            About
          </button>
        ) : null}
      </header>

      {children}

      {infoModalContent && infoOpen
        ? createPortal(
            // Portaled to <body> so a `position: fixed` ancestor (transform / filter /
            // contain / will-change) in a host sim can't trap or clip the modal.
            // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismissal is a convenience; Escape and the close button are the keyboard-accessible paths.
            // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal is a convenience; Escape and the close button are the keyboard-accessible paths.
            <div
              className="simulation-frame-info-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setInfoOpen(false);
              }}
            >
              <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setInfoOpen(false);
                }}
              >
                <h2 id={titleId}>About the {simTitle} Simulation</h2>
                {infoModalContent}
                <button
                  ref={closeRef}
                  type="button"
                  className="modal-close"
                  onClick={() => setInfoOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
```

> The modal is portaled to `<body>` so a `position: fixed` ancestor (a transform/filter/`contain`/`will-change` on a host wrapper) can't trap or clip it. Because the portaled node is no longer a descendant of `.simulation-frame`, its CSS lives at the top level under the `.simulation-frame-info-overlay` root (Step 3), not nested under the frame root. Biome's `a11y` group flags the overlay's click handler — both `noStaticElementInteractions` and `useKeyWithClickEvents` get a targeted `biome-ignore` (Esc + Close button are the accessible paths). Do NOT silence by disabling the rules globally.

**Step 5: Run the full file to verify all tests pass**

```bash
yarn workspace @concord-consortium/mass-sims-shared test simulation-frame
```

Expected: PASS (all 16 — Task 3's 7 + the 9 added here).

**Step 6: Typecheck, lint, commit**

```bash
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
git add packages/shared/src/components/simulation-frame
git commit -m "feat(shared): add accessible info modal to SimulationFrame"
```

---

## Task 5: `packages/sim-frame-preview` workspace — four widths × 562

A non-deployed dev page rendering the frame at all four target widths simultaneously with placeholder slot content. Lives under `packages/` so CI's deploy loop and `gen-index` (both `simulations/*`-only) ignore it automatically.

**Files:**
- Create: `packages/sim-frame-preview/package.json`
- Create: `packages/sim-frame-preview/tsconfig.json`
- Create: `packages/sim-frame-preview/tsconfig.node.json`
- Create: `packages/sim-frame-preview/vite.config.ts`
- Create: `packages/sim-frame-preview/vitest.config.ts`
- Create: `packages/sim-frame-preview/index.html`
- Create: `packages/sim-frame-preview/src/main.tsx`
- Create: `packages/sim-frame-preview/src/preview.tsx`
- Create: `packages/sim-frame-preview/src/test-setup.ts`
- Create: `packages/sim-frame-preview/src/preview.test.tsx`

**Step 1: package.json** (mirrors a sim, but **no `build` script** — it must never be deployed; `lerna run build` skips workspaces without a `build` script):

```json
{
  "name": "sim-frame-preview",
  "version": "0.0.1",
  "private": true,
  "description": "Dev-only preview of SimulationFrame at the four target widths. Not deployed.",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rimraf --glob dist '*.tsbuildinfo'"
  },
  "dependencies": {
    "@concord-consortium/mass-sims-shared": "0.0.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.0.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.2",
    "jsdom": "^25.0.0",
    "typescript": "^6.0.0",
    "vite": "^8.0.0",
    "vitest": "^4.0.0"
  }
}
```

**Step 2: tsconfig.json** (copy `simulations/sim-one/tsconfig.json` verbatim) and **tsconfig.node.json** (copy `simulations/sim-one/tsconfig.node.json` verbatim).

**Step 3: vite.config.ts** — minimal dev config (no `base`/publicPath gymnastics needed; not deployed):

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 8090, open: false },
});
```

**Step 4: vitest.config.ts** — start from `simulations/sim-one/vitest.config.ts` (`jsdom`, `globals: false`, `css: false`) and add `setupFiles` for jest-dom:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

Also create `packages/sim-frame-preview/src/test-setup.ts` — mirror `packages/shared/src/test-setup.ts` exactly (jest-dom matchers + the `afterEach(cleanup)` that `globals: false` requires, so adding a second preview test later won't leak DOM across tests):

```ts
// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, …)
// on Vitest's expect, and — because this file is in the tsconfig include — provides the
// global type augmentation so those matchers typecheck in *.test.tsx files.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, Testing Library does not auto-register its `afterEach(cleanup)`
// (it only does so when it detects injected test-runner globals). Without this, rendered
// DOM accumulates across tests and queries like `getByRole` match elements from prior
// tests. Register cleanup explicitly so each test starts from a clean document.
afterEach(() => {
  cleanup();
});
```

**Step 5: index.html** (copy `simulations/sim-one/index.html`, update `<title>` to `SimulationFrame Preview`; keep `<div id="root">` and the `src/main.tsx` module script). Read the sim-one file first to match its exact shape.

**Step 6: src/main.tsx** — entry; imports the shared global stylesheet exactly once (this is what emits the `:root` custom properties):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@concord-consortium/mass-sims-shared/styles/global.scss";
import { Preview } from "./preview";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Could not find #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
```

**Step 7: src/preview.tsx** — renders the frame at each target width with placeholder slot content:

```tsx
import { Section, SimulationFrame } from "@concord-consortium/mass-sims-shared";

// The four exact widths from ui-design-plan.md §6. Height is fixed at 562 px by the frame.
const WIDTHS: Array<{ px: number; label: string; note?: string }> = [
  { px: 1044, label: "1044 — Activity Player Full Width" },
  { px: 1024, label: "1024 — Standalone" },
  { px: 989, label: "989 — AP 2-col, left hidden (tightest wide)" },
  {
    px: 676,
    label: "676 — AP 2-col, left shown (NARROW)",
    note: "Narrow-mode layout is deferred (Q30). The wide 3-column grid intentionally overflows here.",
  },
];

const PLACEHOLDER_TRIALS = [1, 2, 3, 4, 5, 6, 7, 8];

function PlaceholderTrials() {
  return (
    <>
      {PLACEHOLDER_TRIALS.map((n) => (
        <div key={n} style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
          Trial {n}
        </div>
      ))}
    </>
  );
}

function FrameAtWidth({ px, label, note }: { px: number; label: string; note?: string }) {
  return (
    <figure style={{ margin: "0 0 32px" }}>
      <figcaption style={{ fontFamily: "system-ui", fontSize: 13, marginBottom: 6 }}>
        <strong>{label}</strong>
        {note ? <span style={{ color: "#b45309" }}> — {note}</span> : null}
      </figcaption>
      {/* Outer box clamps width to the target; overflow:auto reveals any overflow honestly. */}
      <div style={{ width: px, maxWidth: "100%", overflow: "auto", border: "1px solid #999" }}>
        <SimulationFrame projectName="Mass Sims" simTitle="Preview Sim" tagline="Placeholder tagline" infoModalContent={<p>Placeholder info modal content.</p>}>
          <SimulationFrame.Trials>
            <PlaceholderTrials />
          </SimulationFrame.Trials>
          <SimulationFrame.Simulation instruction="Placeholder instruction">
            <div
              style={{
                display: "grid",
                placeItems: "center",
                height: "100%",
                background: "#eef",
              }}
            >
              simulation placeholder
            </div>
          </SimulationFrame.Simulation>
          <SimulationFrame.Data>
            <Section title="Sub-section A">data placeholder A</Section>
            <Section title="Sub-section B">data placeholder B</Section>
          </SimulationFrame.Data>
        </SimulationFrame>
      </div>
    </figure>
  );
}

export function Preview() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "system-ui" }}>SimulationFrame — four target widths × 562 px</h1>
      {WIDTHS.map((w) => (
        <FrameAtWidth key={w.px} {...w} />
      ))}
    </main>
  );
}
```

**Step 8: src/preview.test.tsx** — a smoke test so the preview is covered by `yarn test`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Preview } from "./preview";

describe("Preview", () => {
  it("renders a SimulationFrame for each of the four target widths", () => {
    const { getAllByRole } = render(<Preview />);
    // Each frame contributes a Trials region; four widths → four Trials regions.
    expect(getAllByRole("region", { name: "Trials" })).toHaveLength(4);
  });
});
```

**Step 9: Install so Yarn links the new workspace**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
yarn install
```

Expected: the new `sim-frame-preview` workspace is recognized and `@concord-consortium/mass-sims-shared` is symlinked into it.

**Step 10: Typecheck, lint, test the workspace**

```bash
yarn workspace sim-frame-preview typecheck
yarn workspace sim-frame-preview lint
yarn workspace sim-frame-preview test
```

Expected: all pass.

**Step 11: Visual verification — the Phase 1 "four widths × 562" check**

```bash
yarn workspace sim-frame-preview dev
```

Open the printed URL (http://localhost:8090). Confirm:
- Four labeled frames render, each 562 px tall.
- 1044 / 1024 / 989 px: three columns side-by-side (Trials | Simulation | Data), each a rounded Section with a title chip; Data shows two stacked sub-sections; the Simulation chip shows the instruction.
- 676 px: the wide grid overflows inside its `overflow:auto` box — the expected, documented signal that narrow mode (Q30) is still owed.
- Clicking the **About** button opens the modal; **Close** and **Esc** dismiss it.

Stop the dev server (Ctrl-C) when done. **Capture a screenshot for the PR if convenient** (this is the artifact the team iterates on once designs land).

**Step 12: Commit**

```bash
git add packages/sim-frame-preview package.json yarn.lock
git commit -m "feat(preview): add sim-frame-preview dev workspace (4 widths × 562)"
```

> `package.json`/`yarn.lock` may change from `yarn install` resolving the new workspace. Include them if so; otherwise omit.

---

## Task 6: Full-repo verification + status note

**Files:**
- Modify: `docs/infrastructure-plan.md` (status line only — optional but recommended)

**Step 1: Run the whole repo's checks as CI would**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
yarn typecheck
yarn lint
yarn test
yarn gen-index --check
```

Expected: all pass. `gen-index --check` must still pass — the preview is under `packages/`, so it must NOT appear in `index.html`; if this check fails, the preview was misplaced under `simulations/`. Confirm `index.html` lists only `sim-one`/`sim-two`.

**Step 2: Confirm shared changes didn't break sim consumers**

```bash
MASS_SIMS_VERSION_PATH=version/release yarn build
```

Expected: `sim-one`, `sim-two`, and `starter` all build (they consume shared; this proves the new exports + `.scss` typing setup don't break the consumer build path). `sim-frame-preview` is skipped (no `build` script) — that's intended.

**Step 3 (optional): Update the infra plan's Phase 1 status**

In `docs/infrastructure-plan.md`, update the top `**Status:**` line and/or the Phase 1 bullet to note the `SimulationFrame`/`Section` skeleton and the four-width render check are complete, with narrow mode + final visuals deferred. Keep it factual.

**Step 4: Commit any status edits**

```bash
git add docs/infrastructure-plan.md
git commit -m "docs: mark SimulationFrame skeleton + 4-width check complete in Phase 1"
```

---

## Done criteria

- [ ] `<SimulationFrame>` implements the §3 API exactly: `projectName` / `simTitle` / `tagline` / `infoModalContent` props + `.Trials` / `.Simulation` / `.Data` slots.
- [ ] `<Section>` renders a labeled region (heading + `aria-labelledby` via a generated `useId()`), accepts `title` / `instruction` / `className` / children.
- [ ] Info modal opens from an accessible button and closes via button + Esc; no dialog in the DOM until opened.
- [ ] All visual specifics (widths, radius, padding, chrome heights, colors) come from `tokens.scss`; no hard-coded hex/size/spacing in component SCSS.
- [ ] `packages/sim-frame-preview` renders the frame at 1044/1024/989/676 × 562; not deployed, not in `index.html`.
- [ ] `yarn typecheck && yarn lint && yarn test && yarn gen-index --check` all green; `yarn build` builds all sims.
- [ ] Narrow-mode collapse, final Section/chip visuals, and slot proportion values remain untouched/deferred.

## Deferred follow-ups (out of scope here)

- Narrow-mode (676 px) collapsible/overlay behavior + the `layout="narrow" | "wide"` seam (ui-design-plan.md §8, Q30).
- Final Section visual treatment: chip styling, background, shadow, border, padding scale, title typography.
- Designer-tuned slot proportions (the `$column-*` token *values*).
- Replacing the minimal info modal with the shared `Dialog` (focus-trap, credits, reload-warning variants).
- Chrome suppression when embedded in Activity Player (Q31).
- **Configurable heading level for nested Sections — an a11y/structure concern, NOT visual.** `Section` hard-codes `<h2>`. Sub-sections composed inside the Data slot (ui-design-plan.md §3) therefore render `<h2>` *inside* the Data region's own `<h2>`, so the heading outline is flat and doesn't reflect the nesting (a sub-section should be `<h3>`). This is a heading-hierarchy concern (WCAG 1.3.1), distinct from the deferred *visual* sub-section treatment. Address it when the Data sub-section variant lands — e.g. a `headingLevel` (or `as`) prop on `Section`. (`aria-labelledby` labeling is already correct regardless of level, which is why this is low-priority rather than broken.)
