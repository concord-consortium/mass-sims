# Phase 2a — Shared Library Rebuild Against the Demo Design

> Implementation plan executed on this branch; kept as a task-by-task record.

**Goal:** Rebuild the shared library to match the demo design (see [demo](https://models-resources.concord.org/demos/branch/masssims/) and source at `~/Documents/webdev/demos`). Concrete deliverables: rewrite `tokens.scss` and `global.scss` to the demo's palette / typography / dimensions; ship partner-branding SVGs in the shared package; restructure `<SimulationFrame>`'s title bar (drop `projectName`, drop the project-bar row, add the partner-branding cluster + restyled About button); add new `<TrialCard>` and `<DataSubsection>` components per the demo; update `packages/sim-frame-preview` to render the new shapes. Replace the About modal with the demo's draggable top-right side panel (Task 7), then sweep verification (Task 8).

**Architecture:** Token-driven throughout. `tokens.scss` is the single source of truth for color / typography / spacing / dimensions / radii / focus; `global.scss` imports tokens once per sim and emits the runtime `:root` custom-property mirror. Component SCSS files `@use "tokens"` and namespace their references. `<SimulationFrame>` renders a single 50 px title bar (no project bar — that's Activity Player's chrome) with sim title + tagline on the left and partner logos + About button on the right. `<TrialCard>` carries the common per-trial chrome (letter badge A→J, selected/hover/active states, reset affordance on selected) and accepts sim-specific content as children. `<DataSubsection>` is a flat, count-agnostic sub-section primitive used inside the Data slot — h3 heading, auto-divider between consecutive siblings, NOT a `<Section>` variant.

**Tech Stack:** React 19.2, TypeScript 6, Vite 8, Vitest 4 + @testing-library/react (jsdom), plain (global) SCSS via side-effect imports scoped under a root class, `clsx` for class composition, Biome (lint/format).

---

## Conventions discovered in the codebase (follow these exactly)

These were verified by reading the existing code. Honoring them keeps the diff idiomatic.

- **Tests import from `"vitest"` explicitly** — `globals: false` is set in every `vitest.config.ts`. Never rely on injected globals.
- **`@testing-library/jest-dom` is already wired** (added in the SimulationFrame branch) via per-workspace `test-setup.ts` files referenced from `vitest.config.ts` `setupFiles`. Component tests can use `toBeInTheDocument()`, `toHaveAttribute()`, `toHaveClass()`, etc. without further setup.
- **`@testing-library/user-event` is NOT installed.** Use `fireEvent` (re-exported from `@testing-library/react`) for clicks and `fireEvent.keyDown(el, { key: "Escape" })` for Esc.
- **Component styles are plain (global) SCSS imported for side-effect** — `import "./trial-card.scss";`, NOT `import styles from "./trial-card.module.scss"`. JSX uses plain string class names composed with `clsx`. **Scope every component's rules under a single root class** (`.trial-card { .letter-badge { … } }`). Do NOT use `*.module.scss`.
- **`css: false` in Vitest** ignores side-effect `.scss` imports. Assert on roles / text / ARIA / plain-string class names — never on hashed module-class output (there isn't any).
- **Tokens accessed via `@use "../../styles/tokens" as tokens`** from a relative path inside component SCSS, then `tokens.$foo`. Nothing outside `tokens.scss` hard-codes color/size/spacing/radius.
- **Shared barrel** is `packages/shared/src/index.ts`; new components are exported there.
- **Biome formatting:** double quotes, semicolons, trailing commas "all", 2-space indent, 100-char lines, `always` arrow parens. Run `yarn lint:fix` before committing if unsure.
- **SVG assets live under `packages/shared/src/assets/`** — the project-wide convention is a single `assets/` folder per package holding all icon files, with subfolders for grouping. Partner **logos** go in `assets/branding/` (`dese-logo.svg`, `cc-logo.svg`); standalone **UI icons** go in the `assets/` root (`info-icon.svg`, `close-icon.svg`, `reset-icon.svg`). Components import them by relative path, e.g. from `components/simulation-frame/`: `import deseLogo from "../../assets/branding/dese-logo.svg"`.
- **SVG assets imported as URLs:** `import deseLogo from "../../assets/branding/dese-logo.svg"` returns the URL (Vite default behavior; no `vite-plugin-svgr` installed). Render as `<img src={deseLogo} alt="" />` for decorative; use a meaningful `alt` if not decorative.

---

## Scope guardrails (what this plan deliberately does NOT do)

Per the agreed strategy ("rebuild the shared library against the demo, including the About modal as a draggable side panel"):

- **About modal redesign is Task 7.** Earlier tasks (Tasks 1–6) leave the existing centered-overlay-with-portal implementation untouched; Task 7 rewrites it as the demo's draggable top-right side panel. Task 8 is the final verification sweep after the modal lands.
- **No narrow-mode (676 px) collapse behavior.** The wide-mode 3-column grid will continue to overflow at 676 px in the preview. The deferral notice in the preview's 676 panel stays.
- **No `useModelState` / `useSimulationRunner` / Starter sim** — that's Phase 2b. This branch ships only the shared-library shapes and visual treatment; no real sim renders against them.
- **No iframe-phone / logging / scaffolding scripts** — that's Phase 2c.
- **No `<Section>` removal.** `<Section>` stays as the title-chip primitive for the three frame regions (rendered internally by `<SimulationFrame>`). `<DataSubsection>` is a SEPARATE component, not a variant.
- **No removal of `$color-primary` / `$color-accent` from `tokens.scss` UNLESS no consumer references them.** If references exist, replace them with the new semantic token before removing.

---

## Task 0: Confirm branch + green baseline

**Files:** none (git + verification only).

**Step 1: Confirm branch**

```bash
cd /Users/emcelroy/Documents/webdev/mass-sims
git branch --show-current
```

Expected: `phase-2a-shared-rebuild`.

**Step 2: Confirm baseline is green BEFORE changing anything beyond the uncommitted doc updates**

```bash
yarn typecheck && yarn test
yarn workspace sim-frame-preview build || true   # may fail; not required to pass yet
```

Expected: `yarn typecheck` and `yarn test` pass. If anything fails here, STOP and report — it's pre-existing.

`yarn lint` is expected to be clean too but may report formatting differences from work-in-progress edits; if so, run `yarn lint:fix` and verify the result is the same code logic (only whitespace / quote-style changes).

---

## Task 1: Rewrite `tokens.scss` + `global.scss`

The token rewrite is the foundation — every later task depends on it. Replace the current FOSS-seeded values with the demo-derived palette/typography/dimensions from `docs/ui-design-plan.md` §13.

**Files:**
- Modify: `packages/shared/src/styles/tokens.scss` (substantial rewrite)
- Modify: `packages/shared/src/styles/global.scss` (small update to mirror the new token names)

**Step 1: Audit existing token consumers**

Before changing token names, find every reference so nothing breaks silently:

```bash
grep -rn "tokens\.\$" packages/shared/src packages/sim-frame-preview/src 2>/dev/null
grep -rn "@use.*tokens" packages/shared/src packages/sim-frame-preview/src 2>/dev/null
```

The list of tokens currently consumed by component SCSS (Section, SimulationFrame) includes at minimum: `$color-surface`, `$color-surface-muted`, `$color-border`, `$color-text`, `$color-text-muted`, `$color-focus-outline`, `$font-family-base`, `$font-family-condensed`, `$font-size-sm`, `$font-size-xs`, `$font-size-xl`, `$space-2`, `$space-3`, `$space-4`, `$space-5`, `$radius-sm`, `$radius-section`, `$touch-target-min`, `$frame-height`, `$frame-projectbar-height`, `$frame-subheader-height`, `$column-trials-min-width`, `$column-trials-max-width`, `$column-data-min-width`, `$column-data-max-width`, `$black`. Note which of these the rewrite RENAMES or REMOVES:

- `$radius-section` → REMOVE (folds into `$radius-lg: 8px` which becomes the panel/chip/modal radius)
- `$frame-projectbar-height` → REMOVE (no project bar in the sim)
- `$frame-subheader-height` → RENAME to `$frame-titlebar-height` and change `48px` → `50px`
- `$column-trials-min-width` / `$column-trials-max-width` / `$column-data-min-width` / `$column-data-max-width` → REMOVE (replaced with concrete widths per §13)
- `$radius-md` value changes (8 → 6) and `$radius-lg` value changes (12 → 8)
- `$font-size-xl` value changes (22 → 24)
- `$color-border` value changes (`#f2f2f2` → `#555`)
- `$color-surface-muted` value changes (`#f2f2f2` → `#e8e8e8`)
- `$color-focus-outline` value changes (light blue → `#005FCC`)
- `$font-family-base` value changes (Roboto → Lato)

For each rename / removal, replace the SCSS usages in the affected component files in Task 2 itself — do not leave stale references that'd break the build.

**Step 2: Replace `tokens.scss`**

Overwrite `packages/shared/src/styles/tokens.scss` with:

```scss
// =============================================================================
// Mass Sims — design tokens
//
// Single source of truth for color, typography, spacing, dimensions, and a11y
// constraints. Nothing outside this file should hard-code these values.
//
// This module emits NO CSS — it only declares Sass variables. Consumers `@use`
// it from any .scss file and reference values via the module namespace, e.g.:
//
//   @use "@concord-consortium/mass-sims-shared/styles/tokens" as tokens;
//   .my-component { color: tokens.$color-text; }
//
// The runtime CSS custom properties (the `:root { --foo: ... }` block) live in
// `global.scss`, which is imported exactly once per sim from the entry point
// so the `:root` block isn't duplicated across separately-compiled SCSS modules.
//
// Values below are derived from the first realized design (Bananas, AP Full
// Width — see https://models-resources.concord.org/demos/branch/masssims/ and
// docs/ui-design-plan.md §13). They supersede the earlier FOSS-palette
// placeholder. Sim-specific accent colors (e.g. Bananas' healthy/infected
// swatches) live in the sim, not here.
// =============================================================================


// =============================================================================
// COLOR PALETTE (raw — prefer semantic aliases below in component code)
// =============================================================================

$gray-text:              #333;
$gray-text-muted:        #555;
$gray-border-subtle:     #ccc;
$gray-surface-active:    #d0d0d0;
$gray-trial-badge:       #e0e0e0;
$gray-panel-bg:          #e8e8e8;
$gray-surface-hover:     #f0f0f0;
$black:                  #000;
$white:                  #fff;
$focus-blue:             #005FCC;


// =============================================================================
// SEMANTIC COLOR ALIASES (prefer these in component code)
// =============================================================================

$color-text:                       $gray-text;
$color-text-muted:                 $gray-text-muted;
$color-surface:                    $white;
$color-surface-muted:              $gray-panel-bg;
$color-surface-hover:              $gray-surface-hover;
$color-surface-active:             $gray-surface-active;
$color-border:                     $gray-text-muted;          // 2 px strong border
$color-border-subtle:              $gray-border-subtle;       // 1 px modal header rule
$color-divider:                    $gray-text-muted;          // 1 px DataSubsection rule
$color-focus-outline:              $focus-blue;
$color-trial-badge-bg:             $gray-trial-badge;
$color-trial-badge-bg-selected:    $black;


// =============================================================================
// TYPOGRAPHY
// =============================================================================

$font-family-base:       "Lato", system-ui, -apple-system, sans-serif;
$font-family-condensed:  "Roboto Condensed", system-ui, -apple-system, sans-serif;

$font-size-xs:           12px;
$font-size-sm:           14px;
$font-size-base:         16px;
$font-size-lg:           18px;
$font-size-xl:           24px;

$line-height-sm:         20px;   // pairs with 16 px
$line-height-lg:         28px;   // pairs with 24 px


// =============================================================================
// SPACING SCALE (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64)
// =============================================================================

$space-1:                4px;
$space-2:                8px;
$space-3:                12px;
$space-4:                16px;
$space-5:                24px;
$space-6:                32px;
$space-7:                48px;
$space-8:                64px;


// =============================================================================
// LAYOUT DIMENSIONS (see docs/ui-design-plan.md §6-8, §9, §13)
// =============================================================================

// The four target widths and the single fixed height.
$frame-height:                       562px;
$frame-width-ap-full:                1044px;
$frame-width-standalone:             1024px;
$frame-width-ap-2col-hidden:         989px;
$frame-width-ap-2col-shown:          676px;

// Wide / narrow mode switch breakpoint (narrow-mode behavior still being designed).
$frame-narrow-breakpoint:            900px;

// Single header row — there is no project bar in the sim (AP renders that).
$frame-titlebar-height:              50px;

// Concrete column widths at 1044 (AP Full Width). Other widths reuse the same
// trials/data fixed widths and let the simulation column flex.
$column-trials-width:                155px;
$column-simulation-width-ap-full:    564px;
$column-data-width:                  285px;

// Body region around the three-column grid.
$column-gap:                         10px;
$body-padding:                       10px;

// Section title chip (notched overlay on the panel's top edge).
$section-chip-height:                36px;
$section-chip-overlap:               17px;


// =============================================================================
// CORNER RADII
// =============================================================================

$radius-sm:              4px;    // small inner badges (trial-card letter)
$radius-md:              6px;    // buttons (About, trial cards, sim buttons)
$radius-lg:              8px;    // section panel, section chip, info modal


// =============================================================================
// BORDERS
// =============================================================================

$border-strong:          2px solid $color-border;          // Section, button, card, chip
$border-subtle:          1px solid $color-border-subtle;   // modal header rule
$border-divider:         1px solid $color-divider;         // DataSubsection separator


// =============================================================================
// FOCUS / ACCESSIBILITY
// =============================================================================

$focus-outline:          2px solid $color-focus-outline;
$focus-outline-offset:   2px;
$touch-target-min:       44px;   // WCAG / iOS / Material minimum


// =============================================================================
// INFO MODAL (About) — current dimensions; draggable-panel behavior implemented in Task 7
// =============================================================================

$modal-info-width:                   400px;
$modal-info-max-height-pct:          70%;
$modal-info-offset-top:              50px;
$modal-info-offset-right:            10px;
```

**Step 3: Update `global.scss`**

`global.scss` mirrors selected tokens as CSS custom properties for runtime JS / inline-style access. Most consumers go through the SCSS path (Sass-compiled values), so the custom-property mirror is only needed for tokens that JS reads at runtime. Replace with:

```scss
// =============================================================================
// Mass Sims — global stylesheet
//
// Imported exactly ONCE per sim, from its entry point:
//
//   // sim's main.tsx
//   import "@concord-consortium/mass-sims-shared/styles/global.scss";
//
// Everything that produces global CSS output lives here. Per-component .scss
// files should `@use` `tokens.scss` for variable access — they should NOT
// `@use` this file, or the `:root` block would be duplicated across separately-
// compiled SCSS modules in the final bundle.
// =============================================================================

@use "tokens";


// =============================================================================
// CSS CUSTOM PROPERTIES
// Mirror selected tokens at runtime so they're available to inline styles and
// JS-driven theming hooks.
// =============================================================================

:root {
  --color-text:          #{tokens.$color-text};
  --color-surface:       #{tokens.$color-surface};
  --color-focus-outline: #{tokens.$color-focus-outline};
  --touch-target-min:    #{tokens.$touch-target-min};
  --frame-height:        #{tokens.$frame-height};
}
```

`--color-primary` and `--color-accent` removed — the new palette doesn't have those concepts (no brand color; sim-specific accents live in sims).

**Step 4: Fix `section.scss` to use the new token names / values**

Open `packages/shared/src/components/section/section.scss`. Replace `tokens.$radius-section` → `tokens.$radius-lg`. The other tokens it uses (`$color-border`, `$color-surface`, `$color-text`, etc.) keep their names but have new values; check that the visual changes are intentional (border becomes `#555` not the placeholder `#f2f2f2`, surface-muted becomes `#e8e8e8` not `#f2f2f2`).

Also: the panel itself now wants `background: tokens.$color-surface-muted` (the new `#e8e8e8`), NOT `tokens.$color-surface` (white). The demo's Section panel interior is the muted gray, not white. Update.

**Step 5: Fix `simulation-frame.scss` token references**

Open `packages/shared/src/components/simulation-frame/simulation-frame.scss`. Token-name updates:

- `grid-template-rows: tokens.$frame-projectbar-height tokens.$frame-subheader-height 1fr` → `grid-template-rows: tokens.$frame-titlebar-height 1fr` (one header row, not two)
- `grid-template-areas` drops the `projectbar` row (handled fully in Task 3 — leave Task 1 to just rename the token; Task 3 will rewrite the JSX + scss together)

Actually for Task 1, keep `simulation-frame.scss` minimally functional even though Task 3 will rewrite it. The cleanest minimal change is: just replace each token name that was renamed/removed, leaving the broken grid-template-rows reference to be resolved by Task 3. Concretely: replace `$frame-projectbar-height` and `$frame-subheader-height` with `$frame-titlebar-height` and adjust the rows declaration to two rows. The grid-template-areas can stay with `projectbar` for now (Task 3 fixes it).

If that feels too messy, an alternative is to combine Task 1 and Task 3 into one task. Up to the executor — but if doing them separately, prioritize keeping the build green after each.

**Step 6: Replace any `tokens.$column-*-min-width` / `tokens.$column-*-max-width` references**

Replace with the concrete widths: `tokens.$column-trials-width` for trials, `tokens.$column-data-width` for data, the simulation column flexes with `minmax(0, 1fr)`. Concrete diff in `simulation-frame.scss`:

```scss
grid-template-columns:
  tokens.$column-trials-width
  minmax(0, 1fr)
  tokens.$column-data-width;
```

**Step 7: Verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace @concord-consortium/mass-sims-shared test
yarn workspace sim-frame-preview build
```

Expected: all pass. Sass compilation succeeds (no missing-variable errors). Tests still green (no behavior change yet; only visual values). If the preview build fails because of a missing token, find the consumer and replace.

**Step 8: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): rewrite tokens.scss and global.scss to demo-derived values`

(Suggested files to stage when the user is ready: `packages/shared/src/styles`, plus any `packages/shared/src/components` files touched to update token references.)

---

## Task 2: Partner-branding SVGs in shared

The DESE and Concord Consortium logos are project-wide constants. Ship them in `packages/shared` so `<SimulationFrame>` can render them internally.

**Files:**
- Create: `packages/shared/src/assets/branding/dese-logo.svg`
- Create: `packages/shared/src/assets/branding/cc-logo.svg`

**Step 1: Copy the SVGs from the demos repo**

```bash
mkdir -p packages/shared/src/assets/branding
cp ~/Documents/webdev/demos/icons/"DESE Logo.svg" \
   packages/shared/src/assets/branding/dese-logo.svg
cp ~/Documents/webdev/demos/icons/"CC Logo.svg" \
   packages/shared/src/assets/branding/cc-logo.svg
```

Filenames kebab-cased for consistency. (All shared SVGs live under `packages/shared/src/assets/` — logos in the `branding/` subfolder, standalone UI icons at the root.)

**Step 2: Confirm Vite resolves them**

Vite handles `.svg` imports as URL assets by default. No `vite-plugin-svgr` needed; we render with `<img>` tags. To confirm:

```bash
yarn workspace sim-frame-preview build
```

(Will still work; the SVGs aren't imported anywhere yet.) Visually inspect the files: they should render in any browser if you `open` them.

**Step 3: No commit yet**

These files are consumed in Task 3. After copying, stop and wait for user review before doing anything else. Suggest the commit message: `feat(shared): add partner-branding SVGs (DESE + CC)` (or wait to fold them into the Task 3 commit — user's call).

---

## Task 3: SimulationFrame title-bar restructure

The biggest single change. Drop `projectName`. Drop the project-bar row from the grid. Restructure the sub-header into a single 50 px title bar with `simTitle` + `tagline` on the left, partner branding cluster + restyled About button on the right.

**Files:**
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.tsx`
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.scss`
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.test.tsx`
- Modify: `packages/sim-frame-preview/src/preview.tsx` (drop `projectName` prop where it's passed)

**Step 1: Update the failing tests first (TDD)**

Open `simulation-frame.test.tsx`. Changes:

- `renderFrame()` helper: drop `projectName="Mass Sims"` from the JSX (the prop is being removed).
- Test `renders the four header props` → rename to `renders the three header props` and drop the `expect(getByText("Mass Sims")).toBeInTheDocument()` line.
- All other tests that pass `projectName="P"` → drop the prop.
- Add new tests:

```tsx
it("renders the DESE and Concord Consortium partner logos in the title bar", () => {
  const { getByAltText } = renderFrame();
  expect(getByAltText(/DESE/i)).toBeInTheDocument();
  expect(getByAltText(/Concord Consortium/i)).toBeInTheDocument();
});

it("renders the About button with an icon and the 'About' label", () => {
  const { getByRole } = render(
    <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>x</p>}>
      <SimulationFrame.Trials>a</SimulationFrame.Trials>
      <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
      <SimulationFrame.Data>c</SimulationFrame.Data>
    </SimulationFrame>,
  );
  // The button's accessible name is the text 'About' (icon is decorative aria-hidden).
  expect(getByRole("button", { name: "About" })).toBeInTheDocument();
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test simulation-frame` — expect the new tests to fail (the partner logos and the icon aren't there yet), and `renders the three header props` to pass after the projectName line is removed.

**Step 2: Update the component**

Open `simulation-frame.tsx`. Concrete changes:

- Add SVG imports at the top (from `packages/shared/src/assets/branding/`):
  ```tsx
  import ccLogo from "../../assets/branding/cc-logo.svg";
  import deseLogo from "../../assets/branding/dese-logo.svg";
  ```
- Add an info-icon import (also from the demo's `icons/` folder; copy it to `assets/info-icon.svg`):
  ```tsx
  import infoIcon from "../../assets/info-icon.svg";
  ```
  (If you don't add it, the About button reads as just "About" text without the icon. Per design, include it.)
- Remove `projectName` from the `SimulationFrameProps` interface and from the destructure in the component body.
- Replace the JSX block that renders the project bar + sub-header. Old shape:
  ```tsx
  return (
    <div className="simulation-frame">
      <div className="project-bar">{projectName}</div>
      <header className="sub-header">
        <h1 className="sim-title">{simTitle}</h1>
        <span className="tagline">{tagline}</span>
        {infoModalContent ? (
          <button ...>About</button>
        ) : null}
      </header>
      {children}
      {/* modal (unchanged in Task 3) */}
    </div>
  );
  ```
  New shape:
  ```tsx
  return (
    <div className="simulation-frame">
      <header className="title-bar">
        <div className="title-bar-left">
          <h1 className="sim-title">{simTitle}</h1>
          <span className="tagline">{tagline}</span>
        </div>
        <div className="title-bar-right">
          <img className="partner-logo" src={deseLogo} alt="DESE" />
          <img className="partner-logo" src={ccLogo} alt="Concord Consortium" />
          {infoModalContent ? (
            <button
              aria-haspopup="dialog"
              className="info-button"
              ref={triggerRef}
              type="button"
              onClick={() => setInfoOpen(true)}
            >
              <img src={infoIcon} alt="" aria-hidden="true" className="info-button-icon" />
              About
            </button>
          ) : null}
        </div>
      </header>

      {children}

      {/* About modal — UNCHANGED in Task 3 (Task 7 handles redesign) */}
      {infoModalContent && infoOpen ? createPortal(/* … existing content … */, document.body) : null}
    </div>
  );
  ```

**Step 3: Update the SCSS**

Open `simulation-frame.scss`. Replace the existing `.simulation-frame { … }` block with the new layout (the existing modal-portal styles below stay):

```scss
@use "../../styles/tokens" as tokens;

.simulation-frame {
  background: tokens.$color-surface;
  box-sizing: border-box;
  color: tokens.$color-text;
  display: grid;
  font-family: tokens.$font-family-base;
  gap: tokens.$column-gap;
  grid-template-areas:
    "titlebar  titlebar    titlebar"
    "trials    simulation  data";
  grid-template-columns:
    tokens.$column-trials-width
    minmax(0, 1fr)
    tokens.$column-data-width;
  grid-template-rows: tokens.$frame-titlebar-height 1fr;
  height: tokens.$frame-height;
  padding: tokens.$body-padding;
  width: 100%;

  .title-bar {
    align-items: center;
    background: tokens.$color-surface;
    display: flex;
    grid-area: titlebar;
    justify-content: space-between;
    padding: 0 tokens.$space-2 0 tokens.$space-4;
  }

  .title-bar-left {
    align-items: baseline;
    display: flex;
    gap: tokens.$space-2;
  }

  .title-bar-right {
    align-items: center;
    display: flex;
    gap: tokens.$space-3;
  }

  .sim-title {
    color: tokens.$color-text;
    font-size: tokens.$font-size-xl;
    font-weight: 700;
    line-height: tokens.$line-height-lg;
    margin: 0;
  }

  .tagline {
    color: tokens.$color-text;
    font-size: tokens.$font-size-base;
    line-height: tokens.$line-height-sm;
  }

  .partner-logo {
    display: block;
  }

  .info-button {
    align-items: center;
    background: tokens.$color-surface;
    border: tokens.$border-strong;
    border-radius: tokens.$radius-md;
    color: tokens.$color-text;
    cursor: pointer;
    display: flex;
    font-family: tokens.$font-family-base;
    font-size: tokens.$font-size-base;
    font-weight: 700;
    gap: tokens.$space-1 + 2;   // 6 px — between icon and "About"
    height: 34px;               // visible height; expanded touch area via ::after
    line-height: tokens.$line-height-sm;
    padding: 3px tokens.$space-3 3px tokens.$space-2;
    position: relative;
  }

  // Expanded touch target — extends 7 px above and below to reach 48 px effective.
  .info-button::after {
    bottom: -7px;
    content: "";
    left: 0;
    position: absolute;
    right: 0;
    top: -7px;
  }

  .info-button:hover,
  .info-button:focus-visible {
    background: tokens.$color-surface-hover;
  }

  .info-button:active {
    background: tokens.$color-surface-active;
  }

  .info-button:focus-visible {
    outline: tokens.$focus-outline;
    outline-offset: tokens.$focus-outline-offset;
  }

  .info-button-icon {
    height: 24px;
    pointer-events: none;
    width: 24px;
  }

  // Grid-area assignments applied to each slot's Section root (a direct child) via className.
  .trials-area    { grid-area: trials; }
  .simulation-area { grid-area: simulation; }
  .data-area      { grid-area: data; }
}

// Portaled modal styles (unchanged in Task 3 — Task 7 will rewrite for the draggable panel).
.simulation-frame-info-overlay {
  // … existing rules unchanged …
}
```

The `gap` value `tokens.$space-1 + 2` is intentional — the demo's gap between icon and text is 6 px, not 8 px. Sass arithmetic handles it; alternatively add a `$space-1-5: 6px` token if you'd rather avoid arithmetic.

**Step 4: Update `preview.tsx` to drop the `projectName` prop**

Open `packages/sim-frame-preview/src/preview.tsx`. The `<SimulationFrame projectName="Mass Sims" ...>` passes `projectName`; drop it. (Other preview updates land in Task 7.)

**Step 5: Run tests**

```bash
yarn workspace @concord-consortium/mass-sims-shared test simulation-frame
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace sim-frame-preview typecheck
```

Expected: all pass. The new `renders partner logos` test passes because the `<img>` elements with alt="DESE" / alt="Concord Consortium" are present. The `renders the About button with icon and label` test passes because the button's accessible name is "About" (computed from text content, icon is decorative).

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): restructure SimulationFrame title bar; drop projectName; add partner branding`

(Suggested files to stage when the user is ready: `packages/shared/src/components/simulation-frame`, `packages/sim-frame-preview/src/preview.tsx`, and — if the partner SVGs from Task 2 haven't been committed yet — `packages/shared/src/assets/branding`.)

---

## Task 4: `<TrialCard>` component (TDD)

The common per-trial chrome. Letter badge auto-derived from `index` (0→A, 1→B, …, 9→J). Selected/hover/active states. 44 × 44 px reset affordance shown only on the selected card.

**Files:**
- Create: `packages/shared/src/components/trial-card/trial-card.tsx`
- Create: `packages/shared/src/components/trial-card/trial-card.scss`
- Create: `packages/shared/src/components/trial-card/trial-card.test.tsx`
- Modify: `packages/shared/src/index.ts`
- Copy `~/Documents/webdev/demos/icons/Reset ICON.svg` to `packages/shared/src/assets/reset-icon.svg` (UI icons live in the shared `assets/` root)

**Step 1: Copy the reset icon**

```bash
cp ~/Documents/webdev/demos/icons/"Reset ICON.svg" \
   packages/shared/src/assets/reset-icon.svg
```

**Step 2: Write the failing tests**

Create `packages/shared/src/components/trial-card/trial-card.test.tsx`:

```tsx
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrialCard } from "./trial-card";

describe("TrialCard", () => {
  it("derives the letter badge from index (A through J)", () => {
    const cases: Array<[number, string]> = [
      [0, "A"], [1, "B"], [2, "C"], [3, "D"], [4, "E"],
      [5, "F"], [6, "G"], [7, "H"], [8, "I"], [9, "J"],
    ];
    for (const [index, letter] of cases) {
      const { getByText, unmount } = render(
        <TrialCard index={index} selected={false} onSelect={() => {}} onReset={() => {}}>
          content
        </TrialCard>,
      );
      expect(getByText(letter)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders children as the card's body content", () => {
    const { getByText } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}} onReset={() => {}}>
        <span>Offspring: 12</span>
      </TrialCard>,
    );
    expect(getByText("Offspring: 12")).toBeInTheDocument();
  });

  it("calls onSelect when the card body is clicked", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <TrialCard index={0} selected={false} onSelect={onSelect} onReset={() => {}}>
        body
      </TrialCard>,
    );
    fireEvent.click(getByRole("button", { name: /trial a/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does NOT show the reset button when not selected", () => {
    const { queryByRole } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    expect(queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
  });

  it("shows the reset button when selected", () => {
    const { getByRole } = render(
      <TrialCard index={0} selected={true} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    expect(getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("calls onReset when the reset button is clicked and does NOT call onSelect", () => {
    const onReset = vi.fn();
    const onSelect = vi.fn();
    const { getByRole } = render(
      <TrialCard index={0} selected={true} onSelect={onSelect} onReset={onReset}>
        body
      </TrialCard>,
    );
    fireEvent.click(getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    // The reset button is a sibling of the card button (NOT nested), so the reset
    // click can't bubble to onSelect — no stopPropagation needed in the implementation.
    // This assertion locks in that structural choice.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the reset button aria-disabled when resetDisabled is true and does not call onReset", () => {
    const onReset = vi.fn();
    const { getByRole } = render(
      <TrialCard
        index={0}
        selected={true}
        onSelect={() => {}}
        onReset={onReset}
        resetDisabled={true}
      >
        body
      </TrialCard>,
    );
    const resetBtn = getByRole("button", { name: /reset/i });
    expect(resetBtn).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(resetBtn);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("exposes both the card and reset as real <button> elements with distinct accessible names", () => {
    // Locks in the architectural choice: NO nested-button anti-pattern, NO role="button"
    // workaround. Two real <button> siblings inside a positioning wrapper.
    const { getByRole, container } = render(
      <TrialCard index={2} selected={true} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    const card = getByRole("button", { name: "Trial C" });
    const reset = getByRole("button", { name: "Reset trial C" });
    expect(card.tagName).toBe("BUTTON");
    expect(reset.tagName).toBe("BUTTON");
    // The reset must not be a DOM descendant of the card button (nested buttons are
    // invalid HTML and produce inconsistent screen-reader behavior).
    expect(card.contains(reset)).toBe(false);
    // Both buttons live inside the same wrapper.
    const wrapper = container.querySelector(".trial-card-wrapper");
    expect(wrapper?.contains(card)).toBe(true);
    expect(wrapper?.contains(reset)).toBe(true);
  });

  it("applies the selected class to the wrapper", () => {
    const { container } = render(
      <TrialCard index={0} selected={true} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    expect(container.querySelector(".trial-card-wrapper")).toHaveClass("selected");
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test trial-card` — expect FAIL (module not found).

**Step 3: Write the SCSS**

Create `packages/shared/src/components/trial-card/trial-card.scss`:

```scss
@use "../../styles/tokens" as tokens;

// The wrapper is the positioning context. The card and the reset are siblings inside it
// (NOT nested), so they're both real <button> elements with no nested-interactive trickery.
// The card fills the wrapper (100%/100%); the reset button is position: absolute relative
// to the wrapper and slightly overhangs the upper-right corner.
.trial-card-wrapper {
  flex-shrink: 0;
  height: 136px;
  position: relative;
  width: 120px;

  .trial-card {
    background: tokens.$color-surface;
    border: tokens.$border-strong;
    border-radius: tokens.$radius-md;
    box-sizing: border-box;
    cursor: pointer;
    font-family: tokens.$font-family-condensed;
    height: 100%;
    padding: 0;
    position: relative;
    width: 100%;
  }

  .trial-card:hover,
  .trial-card:focus-visible {
    background: tokens.$color-surface-hover;
  }

  .trial-card:active {
    background: tokens.$color-surface-active;
  }

  .trial-card:focus-visible {
    outline: tokens.$focus-outline;
    outline-offset: tokens.$focus-outline-offset;
  }

  // Selected styling lives on the wrapper so it can affect both the card AND descendants
  // of the wrapper (including the reset button's appearance, if needed).
  &.selected .trial-card {
    background: tokens.$color-surface-hover;
    border-color: tokens.$color-text;
    box-shadow: 0 0 0 1px tokens.$color-text;
  }

  .letter-badge {
    align-items: center;
    background: tokens.$color-trial-badge-bg;
    border-radius: tokens.$radius-sm;
    color: tokens.$color-text;
    display: flex;
    font-family: tokens.$font-family-base;
    font-size: tokens.$font-size-lg;
    font-weight: 700;
    height: 28px;
    justify-content: center;
    left: tokens.$space-1;
    line-height: 1;
    position: absolute;
    top: tokens.$space-1;
    width: 28px;
  }

  &.selected .letter-badge {
    background: tokens.$color-trial-badge-bg-selected;
    color: tokens.$color-surface;
  }

  .body {
    bottom: tokens.$space-1;
    color: tokens.$color-text;
    display: flex;
    flex-direction: column;
    font-size: tokens.$font-size-base;
    gap: 1px;
    left: tokens.$space-1;
    line-height: 1.3;
    position: absolute;
    right: tokens.$space-1;
    text-align: center;
    top: 38px;
  }

  // Reset button — sibling of .trial-card, positioned absolute against the wrapper.
  // Overhangs the upper-right corner by 4 px (matches the demo).
  .reset-button {
    align-items: center;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    height: tokens.$touch-target-min;
    justify-content: center;
    padding: 0;
    position: absolute;
    right: -4px;
    top: -4px;
    width: tokens.$touch-target-min;
    z-index: 1;  // ensures the reset overlays the card border at the corner
  }

  .reset-button:focus-visible {
    outline: none;
  }

  // Visible 28 × 28 focus ring inside the larger touch area.
  .reset-button:focus-visible::after {
    border-radius: tokens.$radius-sm;
    content: "";
    height: 28px;
    outline: tokens.$focus-outline;
    outline-offset: 0;
    position: absolute;
    width: 28px;
  }

  .reset-button-icon {
    background: tokens.$color-surface;
    border-radius: tokens.$radius-sm;
    box-sizing: border-box;
    height: 28px;
    padding: 2px;
    width: 28px;
  }

  .reset-button:hover:not([aria-disabled="true"]) .reset-button-icon,
  .reset-button:focus-visible:not([aria-disabled="true"]) .reset-button-icon {
    background: tokens.$color-surface-hover;
  }

  .reset-button:active:not([aria-disabled="true"]) .reset-button-icon {
    background: tokens.$color-surface-active;
  }

  .reset-button[aria-disabled="true"] {
    cursor: default;
  }

  .reset-button[aria-disabled="true"] .reset-button-icon {
    opacity: 0.35;
  }
}
```

**Step 4: Write the component**

Create `packages/shared/src/components/trial-card/trial-card.tsx`:

```tsx
import clsx from "clsx";
import type { ReactNode } from "react";
import resetIcon from "../../assets/reset-icon.svg";
import "./trial-card.scss";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export interface TrialCardProps {
  /** Sim-specific per-trial content (e.g. parents crossed, offspring counts). */
  children?: ReactNode;
  /** Zero-based trial index; the visible letter badge is derived (0 → A, …, 9 → J). */
  index: number;
  /** Whether this trial is the currently-selected one. */
  selected: boolean;
  /** Disable the reset affordance (e.g. nothing to reset yet). Default: false. */
  resetDisabled?: boolean;
  /** Called when the card body is activated. */
  onSelect: () => void;
  /** Called when the reset button is activated (only when selected and not disabled). */
  onReset: () => void;
}

/**
 * The common chrome around a recorded trial. Renders a wrapper div containing two SIBLING
 * buttons: the card itself (activates `onSelect`) and a reset affordance (activates
 * `onReset`, only rendered when `selected`). Both are real `<button>` elements — NO
 * nested buttons, NO `role="button"` workarounds. The wrapper provides the positioning
 * context; CSS visually places the reset button overhanging the card's upper-right corner.
 *
 * Letter assignment is index-based and bounded to A through J (10 trials max). If a sim
 * needs more, expose a `letter` prop in a follow-up.
 */
export function TrialCard({
  children,
  index,
  selected,
  resetDisabled = false,
  onSelect,
  onReset,
}: TrialCardProps) {
  const letter = LETTERS[index] ?? "?";
  return (
    <div className={clsx("trial-card-wrapper", { selected })}>
      <button
        type="button"
        className="trial-card"
        aria-label={`Trial ${letter}`}
        onClick={onSelect}
      >
        <span className="letter-badge" aria-hidden="true">
          {letter}
        </span>
        <div className="body">{children}</div>
      </button>
      {selected ? (
        <button
          type="button"
          className="reset-button"
          aria-label={`Reset trial ${letter}`}
          aria-disabled={resetDisabled || undefined}
          onClick={() => {
            // Sibling of the card button, so the click does NOT bubble to onSelect —
            // no e.stopPropagation() needed.
            if (!resetDisabled) onReset();
          }}
        >
          <img src={resetIcon} alt="" aria-hidden="true" className="reset-button-icon" />
        </button>
      ) : null}
    </div>
  );
}
```

Implementation notes:

- Both the card and the reset are real `<button>` elements as **siblings** inside the wrapper `<div>` — no nested-button anti-pattern, no `role="button"` workaround. Native `<button>` semantics (focus, `Enter`/`Space` activation, screen-reader announcement) come for free.
- Since the reset is a sibling (not a child) of the card, clicking it does NOT bubble into the card's `onClick`. No `e.stopPropagation()` choreography.
- `aria-disabled` is used (rather than the HTML `disabled` attribute) so the reset stays focusable when disabled — letting keyboard users discover it. The click handler checks `resetDisabled` and no-ops.
- The wrapper carries the `selected` class so styling can affect both the card interior (background, border, box-shadow) and the letter badge (color invert) consistently.

**Step 5: Export from the barrel**

In `packages/shared/src/index.ts`, add:

```ts
export { TrialCard, type TrialCardProps } from "./components/trial-card/trial-card";
```

**Step 6: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test trial-card
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
```

Expected: all 8 trial-card tests pass.

**Step 7: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): add TrialCard component with letter badge and reset affordance`

(Suggested files to stage when the user is ready: `packages/shared/src/components/trial-card`, `packages/shared/src/index.ts`.)

---

## Task 5: `<DataSubsection>` component (TDD)

Flat sub-section primitive for the Data slot. h3 heading, auto-divider between consecutive siblings. Count-agnostic — any number of siblings is fine.

**Files:**
- Create: `packages/shared/src/components/data-subsection/data-subsection.tsx`
- Create: `packages/shared/src/components/data-subsection/data-subsection.scss`
- Create: `packages/shared/src/components/data-subsection/data-subsection.test.tsx`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/shared/src/components/data-subsection/data-subsection.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataSubsection } from "./data-subsection";

describe("DataSubsection", () => {
  it("renders the title as an h3", () => {
    const { getByRole } = render(
      <DataSubsection title="Offspring Phenotypes">body</DataSubsection>,
    );
    const heading = getByRole("heading", { level: 3, name: "Offspring Phenotypes" });
    expect(heading).toBeInTheDocument();
  });

  it("renders children", () => {
    const { getByText } = render(
      <DataSubsection title="Fungus Resistance">chart content</DataSubsection>,
    );
    expect(getByText("chart content")).toBeInTheDocument();
  });

  it("renders the root with the data-subsection class for sibling-divider styling", () => {
    const { container } = render(<DataSubsection title="x">body</DataSubsection>);
    expect(container.firstChild).toHaveClass("data-subsection");
  });

  it("supports any count of siblings (one, two, three) without complaint", () => {
    const { getAllByRole } = render(
      <div>
        <DataSubsection title="One">a</DataSubsection>
        <DataSubsection title="Two">b</DataSubsection>
        <DataSubsection title="Three">c</DataSubsection>
      </div>,
    );
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
```

Run `yarn workspace @concord-consortium/mass-sims-shared test data-subsection` — expect FAIL (module not found).

**Step 2: Write the SCSS**

Create `packages/shared/src/components/data-subsection/data-subsection.scss`:

```scss
@use "../../styles/tokens" as tokens;

.data-subsection {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: tokens.$space-3 tokens.$space-2;

  // 1 px horizontal-rule divider between consecutive siblings.
  & + & {
    border-top: tokens.$border-divider;
  }

  .heading {
    color: tokens.$color-text;
    font-family: tokens.$font-family-base;
    font-size: tokens.$font-size-base;
    font-weight: 700;
    line-height: tokens.$line-height-sm;
    margin: 0 0 tokens.$space-1;
    padding: 0 tokens.$space-2;
    text-align: center;
  }

  .body {
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
    width: 100%;
  }
}
```

The `& + &` sibling selector is the key bit — it renders the divider automatically between consecutive `<DataSubsection>` siblings without any prop, count, or wrapper component.

**Step 3: Write the component**

Create `packages/shared/src/components/data-subsection/data-subsection.tsx`:

```tsx
import type { ReactNode } from "react";
import "./data-subsection.scss";

export interface DataSubsectionProps {
  title: string;
  children?: ReactNode;
}

/**
 * Sub-section primitive used INSIDE the Data slot of `<SimulationFrame>`. Sims may render
 * any number of `<DataSubsection>` siblings (one, two, three, more); a 1 px horizontal-rule
 * divider is rendered automatically between consecutive siblings via CSS.
 *
 * NOT a `<Section>` variant — different markup, ARIA structure, and visual treatment by
 * design. The heading is a real `<h3>`, semantically a sub-heading under the Data region's
 * `<h2>`.
 */
export function DataSubsection({ title, children }: DataSubsectionProps) {
  return (
    <div className="data-subsection">
      <h3 className="heading">{title}</h3>
      <div className="body">{children}</div>
    </div>
  );
}
```

**Step 4: Export from the barrel**

In `packages/shared/src/index.ts`:

```ts
export {
  DataSubsection,
  type DataSubsectionProps,
} from "./components/data-subsection/data-subsection";
```

**Step 5: Run tests + verify**

```bash
yarn workspace @concord-consortium/mass-sims-shared test data-subsection
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
```

Expected: all 4 data-subsection tests pass.

**Step 6: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(shared): add DataSubsection component for Data slot sub-sections`

(Suggested files to stage when the user is ready: `packages/shared/src/components/data-subsection`, `packages/shared/src/index.ts`.)

---

## Task 6: Update `sim-frame-preview` to use the new component shapes

The preview workspace's `Preview` needs to render `<TrialCard>` and `<DataSubsection>` instead of inline divs and `<Section>`. Also picks up the title-bar restructure from Task 3.

**Files:**
- Modify: `packages/sim-frame-preview/src/preview.tsx`
- Modify: `packages/sim-frame-preview/src/preview.test.tsx` (lightly — the smoke test should still pass)

**Step 1: Update `preview.tsx`**

Replace the existing `<SimulationFrame.Trials>` content with `<TrialCard>` elements, and `<SimulationFrame.Data>` content with `<DataSubsection>` elements:

```tsx
import {
  DataSubsection,
  SimulationFrame,
  TrialCard,
} from "@concord-consortium/mass-sims-shared";
import { useState } from "react";

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

const PLACEHOLDER_TRIAL_COUNT = 8;

function FrameAtWidth({ px, label, note }: { px: number; label: string; note?: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <figure style={{ margin: "0 0 32px" }}>
      <figcaption style={{ fontFamily: "system-ui", fontSize: 13, marginBottom: 6 }}>
        <strong>{label}</strong>
        {note ? <span style={{ color: "#b45309" }}> — {note}</span> : null}
      </figcaption>
      <div style={{ width: px, maxWidth: "100%", overflow: "auto", border: "1px solid #999" }}>
        <SimulationFrame
          simTitle="Preview Sim"
          tagline="An interactive placeholder simulation"
          infoModalContent={<p>Placeholder info modal content.</p>}
        >
          <SimulationFrame.Trials>
            {Array.from({ length: PLACEHOLDER_TRIAL_COUNT }, (_, i) => (
              <TrialCard
                key={i}
                index={i}
                selected={i === selectedIndex}
                onSelect={() => setSelectedIndex(i)}
                onReset={() => {
                  /* placeholder — no real state */
                }}
                resetDisabled={false}
              >
                <span>Placeholder</span>
                <span>data</span>
              </TrialCard>
            ))}
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
            <DataSubsection title="Sub-section A">data placeholder A</DataSubsection>
            <DataSubsection title="Sub-section B">data placeholder B</DataSubsection>
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

Three notes:

- Each `FrameAtWidth` now has its own `useState` for `selectedIndex` so clicking a trial card actually selects it in the preview. Independent state per frame.
- `PLACEHOLDER_TRIAL_COUNT = 8` — fits within the A–J cap.
- The `onReset` is a no-op placeholder; the demo's reset actually clears the trial, but we don't have model state here, so it just exists to wire up the affordance.

**Step 2: Verify the smoke test still passes**

`preview.test.tsx` checks that 4 frames render. The new shape still renders 4 frames — the test should still pass with no edits. Run:

```bash
yarn workspace sim-frame-preview test
yarn workspace sim-frame-preview typecheck
yarn workspace sim-frame-preview lint
```

**Step 3: Visual verification**

```bash
yarn workspace sim-frame-preview dev
```

Open http://localhost:8090. Expect:

- Each frame shows the new 50 px title bar with simTitle / tagline on the left and DESE / CC logos + About button on the right.
- The Trials column shows 8 TrialCards (A through H). Clicking one selects it (background changes, letter badge inverts to black, reset button appears in upper-right).
- The Simulation column shows the centered "simulation placeholder" content with the "Placeholder instruction" in the chip.
- The Data column shows two DataSubsections with a divider between them.
- The 676 panel still overflows inside its `overflow: auto` box (expected; narrow mode is Q30).
- The About button opens the (centered, portaled) modal — UNCHANGED visually since Task 7 hasn't run yet. The modal redesign to a draggable side panel comes in the next task.

Stop the dev server when done.

**Step 4: Stop and wait for user review before doing anything else**

Suggest the commit message: `feat(preview): exercise new TrialCard + DataSubsection in sim-frame-preview`

(Suggested files to stage when the user is ready: `packages/sim-frame-preview/src`.)

---

## Task 7: About panel redesign — draggable, non-modal, frame-anchored

Replace the existing centered-portaled modal with the draggable side-panel design from the demo (`~/Documents/webdev/demos/index.html`, `.info-modal` and friends). The panel:

- Opens at a default top-right position (50 px from the top, 10 px from the right) **relative to the frame, not the viewport** — so a sim that renders multiple frames keeps each panel attached to its own frame's corner. This means dropping `createPortal` (used by the centered-overlay implementation): the panel renders inline as a child of `.simulation-frame`, which sets `position: relative` to anchor the absolutely-positioned panel.
- Is **non-modal** (`role="dialog"` only — NO `aria-modal`). The sim content behind the panel stays interactive; that's the whole point of being draggable. The dialog still uses `aria-labelledby` so screen readers announce it on open, and the close-via-Escape and focus-management contracts (close button focus on open, About-button focus on close) are unchanged.
- Resets the drag offset to `(0, 0)` on each open — drag position does not persist.
- Has no backdrop scrim — the sim content behind it stays visible AND interactive.
- Toggles closed when the About button is clicked again (matches the demo's toggle behavior).
- Supports **keyboard dragging**: Alt+ArrowKey nudges the panel 10 px in that direction; add Shift for a 40 px step. Required for keyboard accessibility — a draggable element that only responds to a pointing device is exclusionary.
- The pointer-drag gesture attaches `pointermove` / `pointerup` listeners to `window` (not to the handle itself) so the gesture keeps tracking when the pointer leaves the handle. A `dragCleanupRef` + unmount effect ensures those window listeners can't leak if the frame unmounts mid-drag.

**Files:**
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.tsx`
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.scss`
- Modify: `packages/shared/src/components/simulation-frame/simulation-frame.test.tsx`

**Step 1: Update the tests**

Drop the existing `portals the modal outside the .simulation-frame element` test — the new panel is intentionally NOT portaled (frame-anchored placement, see above). Add tests for the new behavior. The panel is non-modal, so do NOT assert `aria-modal="true"` — the absence of `aria-modal` is intentional and a regression would silently re-impose modal semantics.

```tsx
it("renders the About panel inside the frame, anchored top-right with no backdrop scrim", () => {
  const { container, getByRole } = render(/* … standard frame with About content … */);
  fireEvent.click(getByRole("button", { name: /about/i }));
  const dialog = getByRole("dialog");
  // No backdrop overlay element wraps the dialog (no full-screen scrim).
  expect(container.querySelector(".simulation-frame-info-overlay")).toBeNull();
  // The panel lives INSIDE the frame so its `position: absolute` anchors to the frame
  // (which is `position: relative`), not the page — keeping it placed per-frame.
  const frame = container.querySelector(".simulation-frame");
  expect(frame?.contains(dialog)).toBe(true);
});

it("renders a draggable header handle on the About panel", () => {
  const { container, getByRole } = render(/* … */);
  fireEvent.click(getByRole("button", { name: /about/i }));
  // The drag handle is the panel's header, identified by class.
  expect(container.querySelector(".modal-drag-handle")).not.toBeNull();
});

it("opens the About panel at its default position (no drag offset applied)", () => {
  const { getByRole } = render(/* … */);
  fireEvent.click(getByRole("button", { name: /about/i }));
  // Drag position is a transform offset reset to 0,0 on each open, so the panel always
  // reappears at its CSS-anchored default rather than wherever it was last dragged.
  expect(getByRole("dialog")).toHaveStyle({ transform: "translate(0px, 0px)" });
});

it("toggles the About panel closed when the About button is clicked again", () => {
  const { getByRole, queryByRole } = render(/* … */);
  const aboutButton = getByRole("button", { name: /about/i });
  fireEvent.click(aboutButton);
  expect(getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(aboutButton);
  expect(queryByRole("dialog")).not.toBeInTheDocument();
});

it("nudges the About panel with Alt+Arrow keyboard dragging", () => {
  const { getByRole } = render(/* … */);
  fireEvent.click(getByRole("button", { name: /about/i }));
  const dialog = getByRole("dialog");
  // Alt+ArrowRight moves +10px on x; Alt+Shift+ArrowDown then adds +40px on y.
  fireEvent.keyDown(dialog, { key: "ArrowRight", altKey: true });
  expect(dialog).toHaveStyle({ transform: "translate(10px, 0px)" });
  fireEvent.keyDown(dialog, { key: "ArrowDown", altKey: true, shiftKey: true });
  expect(dialog).toHaveStyle({ transform: "translate(10px, 40px)" });
});

it("removes drag listeners from window if the frame unmounts mid-drag", () => {
  // Spy on window.addEventListener / window.removeEventListener, begin a drag
  // (pointerdown on the handle), then unmount BEFORE pointerup. Verify both listeners
  // were detached via the dragCleanupRef + unmount effect — otherwise they'd leak.
});
```

**Step 2: Update the component**

Replace the existing modal JSX with the side-panel implementation. Sketch:

```tsx
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import "./simulation-frame.scss";

// … inside SimulationFrame, replacing the existing modal block …

{infoModalContent && infoOpen ? (
  <div
    aria-labelledby={titleId}
    className="simulation-frame-info-modal"
    role="dialog"
    // NO `aria-modal` — this is a non-modal dialog. The sim content behind the panel
    // stays interactive; that's the point of having a draggable panel.
    style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
    onKeyDown={(e) => {
      if (e.key === "Escape") {
        setInfoOpen(false);
        return;
      }
      // Keyboard dragging — Alt+Arrow nudges by 10 px, Shift adds a larger 40 px step.
      if (!e.altKey) return;
      const step = e.shiftKey ? 40 : 10;
      const delta =
        e.key === "ArrowLeft"  ? { x: -step, y: 0 } :
        e.key === "ArrowRight" ? { x: step,  y: 0 } :
        e.key === "ArrowUp"    ? { x: 0, y: -step } :
        e.key === "ArrowDown"  ? { x: 0, y: step  } : null;
      if (!delta) return;
      e.preventDefault();
      setDragOffset((o) => ({ x: o.x + delta.x, y: o.y + delta.y }));
    }}
  >
    <header className="modal-drag-handle" onPointerDown={beginDrag}>
      <img src={infoIcon} alt="" aria-hidden="true" className="modal-header-icon" />
      <h2 id={titleId} className="modal-title">
        About the {simTitle} Simulation
      </h2>
      <button
        aria-label="Close"
        className="modal-close"
        ref={closeRef}
        type="button"
        onClick={() => setInfoOpen(false)}
      >
        <img src={closeIcon} alt="" aria-hidden="true" className="modal-close-icon" />
      </button>
    </header>
    <div className="modal-body">{infoModalContent}</div>
  </div>
) : null}
```

The About button uses a toggle handler so clicking it while the panel is open closes it. Synchronously reset the drag offset on open so the panel never flashes at its previously-dragged location:

```tsx
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

const toggleInfo = () => {
  if (!infoOpen) setDragOffset({ x: 0, y: 0 });
  setInfoOpen((open) => !open);
};
```

Pointer-driven drag attaches its `pointermove` / `pointerup` listeners to `window` for the duration of the gesture so the drag keeps tracking even when the pointer leaves the header. A `dragCleanupRef` + unmount effect ensure the listeners are removed if the frame unmounts mid-drag:

```tsx
const dragCleanupRef = useRef<(() => void) | null>(null);
useEffect(() => () => dragCleanupRef.current?.(), []);

const beginDrag = (e: ReactPointerEvent<HTMLElement>) => {
  // pointerdown on the close button must NOT start a drag.
  if ((e.target as HTMLElement).closest(".modal-close")) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const originX = dragOffset.x;
  const originY = dragOffset.y;
  const onMove = (move: PointerEvent) => {
    setDragOffset({
      x: originX + (move.clientX - startX),
      y: originY + (move.clientY - startY),
    });
  };
  const stop = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stop);
    dragCleanupRef.current = null;
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stop);
  dragCleanupRef.current = stop;
};
```

**Step 3: Update the SCSS**

Replace the `.simulation-frame-info-overlay` block with:

```scss
.simulation-frame-info-modal {
  background: tokens.$color-surface;
  border: tokens.$border-strong;
  border-radius: tokens.$radius-lg;
  box-shadow: 0 4px 16px rgba(tokens.$black, 0.25);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: tokens.$modal-info-max-height-pct;
  overflow: hidden;
  position: absolute;
  right: tokens.$modal-info-offset-right;
  top: tokens.$modal-info-offset-top;
  width: tokens.$modal-info-width;
  z-index: 101;

  .modal-drag-handle {
    align-items: center;
    border-bottom: tokens.$border-subtle;
    cursor: grab;
    display: flex;
    flex-shrink: 0;
    height: 52px;
    padding: 3px 3px 3px 12px;
    user-select: none;
  }

  .modal-drag-handle:active {
    cursor: grabbing;
  }

  .modal-title {
    color: tokens.$color-text;
    flex: 1;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .modal-close {
    align-items: center;
    background: transparent;
    border: none;
    border-radius: tokens.$radius-sm;
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    height: 44px;
    justify-content: center;
    padding: 0;
    width: 44px;
  }

  .modal-close:hover,
  .modal-close:focus-visible {
    background: tokens.$color-surface-hover;
  }

  .modal-close:active {
    background: tokens.$color-surface-active;
  }

  .modal-close:focus-visible {
    outline: tokens.$focus-outline;
    outline-offset: -2px;
  }

  .modal-body {
    color: tokens.$color-text;
    flex: 1;
    font-size: 16px;
    line-height: 22px;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 20px 20px;
    user-select: text;
  }
}
```

**Drop `createPortal`.** The panel anchors to the frame (not the viewport), so it renders inline as a child of `.simulation-frame`. Add `position: relative` to `.simulation-frame` in its SCSS so the absolutely-positioned panel anchors to it.

**Step 4: Run tests + visual check, then stop and wait for user review before doing anything else**

```bash
yarn workspace @concord-consortium/mass-sims-shared test simulation-frame
yarn workspace @concord-consortium/mass-sims-shared typecheck
yarn workspace @concord-consortium/mass-sims-shared lint
yarn workspace sim-frame-preview dev
# Visually verify drag, drop, reopen-resets-position, Escape, close button, focus return
```

Suggest the commit message: `feat(shared): redesign About modal as draggable top-right panel`

(Suggested files to stage when the user is ready: `packages/shared/src/components/simulation-frame`.)

---

## Task 8: Full-repo verification

**Step 1: Run the whole repo's checks**

```bash
yarn typecheck
yarn lint
yarn test
yarn gen-index --check
```

Expected: all pass. `gen-index --check` confirms the root `index.html` still matches the workspace list (which hasn't changed — only `packages/*` got touched).

**Step 2: Confirm sims still build**

```bash
MASS_SIMS_VERSION_PATH=version/release yarn build
```

Expected: `sim-one`, `sim-two`, `starter` all build cleanly. They consume `@concord-consortium/mass-sims-shared`; if the new token names or removed tokens (e.g. `$radius-section` removal, `$color-primary` removal) broke any consumer, this build catches it.

If anything fails, fix the consumer (replace stale token references) and re-run.

**Step 3: Final visual sweep**

```bash
yarn workspace sim-frame-preview dev
```

Open `http://localhost:8090`. Confirm the full feature set is intact end-to-end:

- Title bar layout at each width (1044 / 1024 / 989) — sim title + tagline left, DESE + CC logos + About button right.
- TrialCards A through H scroll inside the Trials column; clicking one selects; selected card shows reset affordance in upper-right.
- Simulation column renders the placeholder content with the instruction in the chip.
- Data column shows two DataSubsections with the divider between.
- About button opens the **draggable side-panel modal** at the default top-right position; the header drag-handle moves it; closing and reopening returns it to the default position; Escape closes; close button returns focus to the About button.
- 676 panel still overflows (expected; narrow mode is Q30).

No commit for Task 8 — it's verification only.

---

## Done criteria

- [ ] `tokens.scss` and `global.scss` rewritten to demo-derived values; old token names (`$radius-section`, `$frame-projectbar-height`, `$frame-subheader-height`, `$column-*-min/max-width`) removed; consumers updated.
- [ ] Shared SVGs shipped under `packages/shared/src/assets/`: logos (`dese-logo.svg`, `cc-logo.svg`) in `assets/branding/`; UI icons (`info-icon.svg`, `close-icon.svg`, `reset-icon.svg`) in the `assets/` root.
- [ ] `<SimulationFrame>` no longer has `projectName` prop; renders a single 50 px title bar with sim title + tagline on the left and partner logos + restyled About button (icon + "About" text) on the right.
- [ ] `<TrialCard>` exported; renders letter badge from index (A → J); selected/hover/active states work; 44 × 44 px reset affordance appears only when selected; `onSelect` and `onReset` fire as expected; reset click does not bubble to onSelect.
- [ ] `<DataSubsection>` exported; renders title as `<h3>`; auto-divider between consecutive siblings via `& + &`; count-agnostic.
- [ ] `sim-frame-preview` uses the new component shapes; placeholder TrialCards render A through H; clicking selects; two DataSubsections show with divider between.
- [ ] About panel redesigned to the demo's draggable top-right side panel. Drag position resets each open; no backdrop scrim; Escape, close button, and focus-return all work.
- [ ] About panel is non-modal (`role="dialog"` without `aria-modal`); sim content behind it stays interactive.
- [ ] About panel anchors to the frame (not the viewport) — verified by a test that the dialog is contained within `.simulation-frame`.
- [ ] About button toggles the panel closed when clicked while open.
- [ ] Keyboard dragging via Alt+Arrow (Shift+Alt+Arrow for larger step) works; tested.
- [ ] Drag-listener cleanup on frame unmount works; tested via spy on `window.add/removeEventListener`.
- [ ] `yarn typecheck && yarn lint && yarn test && yarn gen-index --check && yarn build` all green; visual sweep at four widths passes.

## Deferred follow-ups (out of scope here)

- Narrow-mode (676 px) collapsible/overlay behavior (UI design plan §15 Q30).
- iframe-phone embedding, dual-transport `useLogEvent`, `yarn new-sim` scaffolding, per-sim CI workflow generation (Phase 2c).
- Sim-title-bar typography at narrower widths (Q32 — designer working on it).
- Trial-card scrolling behavior (Q33).
- DataSubsection vertical proportions (Q34).
- Empty-state copy and styling (Q35).

**Closed since this plan was written (shipped in Phase 2b):**

- ~~Section's notched-chip visual treatment~~ → Implemented: the floating chip notched onto the panel's top edge (centered, half-overlapping the border, with a `•`-separated instruction), using the `$section-chip-height` / `$section-chip-overlap` tokens.
- ~~`useModelState` / `useSimulationRunner` hooks~~ → Shipped.
- ~~Starter sim implementation~~ → Shipped (the random-walk Starter sim).
