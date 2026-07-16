# Mass Sims — UI Design Plan

**Status:** Design realized in the shipped Bananas sim; still iterating on the open questions in §15. The three-region `SimulationFrame`, the `Section`/`DataSubsection`/`TrialCard` chrome, the demo-derived palette and tokens (§13), and the draggable non-modal About panel (§21) are all implemented as described here. Remaining open items are tracked in §15–§16.
**Date:** May 2026 (last reconciled against the code July 7, 2026)
**Companion to:** Infrastructure Plan (`infrastructure-plan.md`)
**Audience:** UI designer, frontend developers building region components, anyone making visual / layout / interaction decisions

This document covers the visual design, layout, dimensions, regions, and per-region behavior for Mass Sims. It is **the working document for UI design** and is expected to iterate as the designer and team refine the look and feel. Things in it are subject to change without breaking the infrastructure plan, which remains the source of truth for tooling, file structure, dependencies, build, CI/CD, hooks API, and deployment.

The two documents are connected by one fixed contract: the `<SimulationFrame>` compound-component API and the set of hooks exported from `packages/shared`. That contract is defined briefly in the infrastructure plan's §3 stub. Everything else about how the regions look, behave, and respond to viewport changes lives here.

---

## 1. Layout philosophy: three regions

The central UI organizing principle is a three-region split:

- **Trials** — a vertically scrollable list of recorded simulation runs/trials.
- **Simulation** — the simulation visualization plus its own controls.
- **Data** — the numeric / graphical record of what's happened, organized into one or more labeled sub-sections.

This is the biggest visual departure from both reference repos (FOSS and DESE). Neither has a clean three-column layout; we build it explicitly in `packages/shared/src/components/simulation-frame/`.

Each region is wrapped in a `<Section>` component — a rounded container with a small labeled title chip notched into its top edge. The chip is the shared visual signature across all three regions.

---

## 2. Proposed layout (CSS Grid)

```
                                                                       ← AP wrapper renders teal
                                                                       ← "[Sim] Simulation" bar
                                                                       ← above this (not ours).
┌──────────────────────────────────────────────────────────────────────┐
│  [Sim title]  tagline           [partner logos]  [About]             │   50 px title bar
├────────────┬────────────────────────────────────┬────────────────────┤
│ [Trials]   │  [Simulation]  •  <instruction>    │  [Data]            │
│            │                                    │                    │
│ ┌──┐ ┌──┐  │ ┌────────────────────────────────┐ │  Sub-section A     │
│ │A │ │B │  │ │                                │ │  ──────────────    │
│ └──┘ └──┘  │ │   Simulation visualization     │ │  Sub-section B     │
│ ┌──┐ …     │ │                                │ │                    │
│ │+ │       │ └────────────────────────────────┘ │                    │
│ └──┘       │  Controls (sim-specific)           │                    │
│ (scrolls)  │                                    │  (scrolls)         │
└────────────┴────────────────────────────────────┴────────────────────┘
```

Three columns side-by-side, each capped with a labeled title chip (a notched overlay — see §3). The simulation column carries secondary instruction text inside its chip, separated from the title by a `•` bullet. Trial cards (with letter badges A, B, C, …) populate the left column from `<TrialCard>`; data sub-sections (titled, separated by a thin divider) populate the right column from `<DataSubsection>`.

### Grid template (current draft)

```css
.simulation-frame {
  display: grid;
  grid-template-columns: 155px minmax(0, 1fr) 285px; /* values at 1044 px — see §13 */
  grid-template-rows: 50px 1fr;
  grid-template-areas:
    "titlebar  titlebar    titlebar"
    "trials    simulation  data";
  height: 562px; /* fixed; see "Device targets" below */
  gap: 10px;
  padding: 10px;
}
```

There is only one header row (the title bar). The teal "[Sim] Simulation" bar above the title bar is rendered by Activity Player's wrapper chrome, not by `<SimulationFrame>` — see §9. Column widths are now pinned per the demo; final per-pixel tuning at the other three target widths is the designer's call.

---

## 3. Section component

Each region renders inside a `<Section>` wrapper — a rounded container with the labeled title chip notched into its top edge. The chip is a real DOM element (not pure decoration) so that screen readers announce the region's title and `aria-labelledby` can point to it.

```tsx
<Section title="Trials">
  ...vertical list of trial rows...
</Section>
```

**Visual specifics, per the demo:** Section panel has a 2 px solid border (`#555`) with an 8 px corner radius and a muted-surface background (`#e8e8e8`). The title chip is a separate element notched onto the top edge of the panel: ~36 px tall, 8 px border-radius, 2 px border, centered horizontally with the chip half-overlapping the panel border. The chip's label is Lato 18 px bold; when an `instruction` is provided (e.g. on the Simulation region) it appears inside the same chip as a 16 px regular sibling, separated from the title by a `•` bullet rendered by Section's own CSS — consumers don't have to include the bullet in their markup.

Sub-sections inside the Data panel do **not** use `<Section>` — they use a separate `<DataSubsection>` component with a flatter visual treatment (centered bold heading, no chip, 1 px horizontal-rule divider rendered automatically between consecutive `<DataSubsection>` siblings). The heading is a real `<h3>`, semantically a sub-heading under the Data region's `<h2>`. `<DataSubsection>` is not a `<Section>` variant — the markup, ARIA structure, and visual treatment differ on purpose. A sim may render any number of `<DataSubsection>` siblings (Bananas happens to have two; others may have one, three, or more).

---

## 4. `<SimulationFrame>` usage

Each region is a named slot. Per-trial cards and Data sub-sections use shared components (`<TrialCard>`, `<DataSubsection>`) so the common chrome stays in the shared library and sims only own their unique content:

```tsx
<SimulationFrame
  simTitle="Bananas"
  tagline="An interactive genetics simulation"
  infoModalContent={<BananasInfo />}
>
  <SimulationFrame.Trials>
    {trials.map((t, i) => (
      <TrialCard
        key={t.id}
        index={i}
        selected={t.selected}
        onSelect={() => selectTrial(t.id)}
        onReset={() => resetTrial(t.id)}
      >
        <TrialCrossLabel parent1={t.p1} parent2={t.p2} />
        <span>Offspring: {t.offspring}</span>
        <HealthyInfectedRow healthy={t.healthyPct} infected={t.infectedPct} />
      </TrialCard>
    ))}
  </SimulationFrame.Trials>

  <SimulationFrame.Simulation instruction="Select two parents to begin">
    <SimulationView />
    <SimulationControls />
  </SimulationFrame.Simulation>

  <SimulationFrame.Data>
    <DataSubsection title="Offspring Phenotypes: All Generations">
      <PieChart .../>
      <Legend healthyPct={...} infectedPct={...} />
    </DataSubsection>
    <DataSubsection title="Fungus Resistance over Generations">
      <LineGraph series={...} />
    </DataSubsection>
  </SimulationFrame.Data>
</SimulationFrame>
```

No `projectName` prop. The teal "**[Sim] Simulation**" bar above the sim is Activity Player's chrome, not ours. The sim's own header (the 50 px **title bar**) is always rendered by `<SimulationFrame>`, with `simTitle` + `tagline` on the left and project-wide partner logos + the About button on the right. The compound-component pattern (named slots) keeps everything simple and type-safe.

---

## 5. Region responsibilities

- **Trials list (left column, vertical):** A vertically stacked, scrollable list of recorded trials/runs. No fixed maximum — the column scrolls when the list overflows. Per-trial UI is composed from `<TrialCard>` (shared library): the card chrome, letter badge (A through J, auto-assigned by index), selection states, and the **reset** affordance that appears on the selected card are all common across sims and live in the shared component. Sim-specific per-trial content (Bananas: parents crossed, offspring count, healthy/infected percentages) goes inside the card as `children`. Trials are reset, not deleted — the demo doesn't show a delete affordance and the resolved decisions explicitly favor reset (FOSS / DESE delete-row is dropped). No drag-to-reorder, no side-by-side comparison view — intentionally minimal.
- **Simulation region (center column, single column):** The simulation visualization (canvas, SVG, Three.js scene, plain DOM, whatever the sim needs) plus that sim's controls (play/pause, sliders, switches, selects) — both stacked vertically. The Simulation region is "the world plus the verbs." Controls live with the viz, not as a separate fourth region. The Section title chip can carry secondary instruction text ("Select two parents to begin") rendered next to the chip itself, separated from the title by a `•` bullet that Section's CSS renders automatically. A trial-indicator badge (showing the currently-selected trial's letter, e.g. "A") may render in the upper-left of the region — that's sim-specific content, not a Section affordance.
- **Data panel (right column):** The numeric/graphical record. May contain multiple labeled sub-sections (e.g., a phenotype pie chart on top and a resistance-over-time line graph below), each wrapped in its own `<DataSubsection>` (NOT `<Section>` — see §3). Pinned to the right at desktop widths.

---

## 6. Dimensions and device targets

The UI designer has specified four exact widths and one fixed height that the layout must support, driven primarily by the Activity Player's embedding modes:

| Mode | Width | Height |
| --- | ---: | ---: |
| Activity Player — Full Width layout | **1044 px** | 562 px |
| Standalone | **1024 px** | 562 px |
| Activity Player — 2-Column layout, left column hidden | **989 px** | 562 px |
| Activity Player — 2-Column layout, left column displayed | **767 px** | 562 px |

The height (**562 px**) is fixed across all four modes — it's the height Activity Player gives the iframe. All four widths accommodate the three-column layout: Trials stays fixed at 155 px while the Simulation and Data columns flex to share the remaining space (see §7).

> **Checking a sim against these numbers.** Every sim's dev server serves a width preview at
> `/__preview` that renders the sim in an iframe at all four widths at once and flags content that
> doesn't fit, clipped text, and elements escaping the frame. The Playwright suite also runs once per
> width. Both read the same source of truth, `packages/shared/src/layout/target-widths.ts` — so if a
> width here changes, change it there (and in `tokens.scss`, which necessarily keeps its own copy).

### Why 562 × 1044: device chrome math

The four widths trace directly to Activity Player's embedding modes, but the 562 px height was chosen by working backwards from the available viewport on every supported device — i.e., the screen minus the browser/OS chrome that sits above and below the page content. The chrome varies significantly:

| Device | Screen | Browser/OS chrome | Available |
| --- | ---: | ---: | ---: |
| Teacher desktop | varies | minimal (assumed plenty of headroom) | ample |
| Chromebook (typical) | 1366 × 768 | 111 px tabs/address/bookmarks + 48 px ChromeOS shelf = 159 px | 1366 × 609 |
| iPad ≤ 9th gen (landscape) | 1024 × 768 | 50 px Safari | 1024 × 718 |
| iPad 10th gen (landscape) | 1180 × 820 | 50 px Safari | 1180 × 770 |
| Android tablet (landscape) | 1280 × 800 | 56 px Chrome + 48 px nav bar = 104 px | 1280 × 696 |

The Chromebook's 609 px available height is the tightest of the supported devices. 562 px content clears it with enough room left over for Activity Player's own chrome (project header, surrounding question panels) below the iframe.

**Edge case: iPad ≤ 9th gen width.** The iPad ≤ 9th-gen viewport is 1024 px wide, but the AP Full Width content target is 1044 px — a 20 px overflow. On this older device the right edge of the content (the data column's outer padding) is clipped or scrolls horizontally. Accepted as a known edge case because (a) 9th-gen iPads are increasingly being replaced by 10th gen (1180 wide, fits comfortably), (b) the overflow is at the data column's outer padding rather than at meaningful content, and (c) designing for 1004 px content to accommodate 9th gen would compromise every other mode.

---

## 7. Column layout — Trials fixed, Simulation and Data flex

All three columns sit side by side, as drawn in the layout diagram. Trials stays fixed at 155 px; the Simulation and Data columns share the remaining space in a 564 : 285 ratio. There is no longer a mode switch — the same three-column grid serves every target width.

The layout is **calibrated at 1044 px** (AP Full Width), where the columns are exactly 155 / 564 / 285, and shrinks proportionally below that down to 767 px (AP 2-col with the instructions panel visible):

| Context                         | Width  | Trials | Simulation | Data |
|---------------------------------|-------:|-------:|-----------:|-----:|
| AP Full Width                   | 1044   | 155    | 564        | 285  |
| Standalone                      | 1024   | 155    | ≈ 551      | ≈ 278 |
| AP 2-col, sidebar collapsed     |  989   | 155    | ≈ 527      | ≈ 267 |
| AP 2-col, sidebar expanded      |  767   | 155    | ≈ 380      | ≈ 192 |

(Approximate — `minmax(0, Nfr)` is what CSS Grid will actually round. The Simulation
and Data columns split `width − 195` px — the space left after Trials (155), the two
column gaps (10 + 10), and the body padding (10 + 10) — in the 564 : 285 ratio.)

The flex ratio is expressed as the unitless `$column-simulation-flex` (564) and `$column-data-flex` (285) tokens, applied as `minmax(0, 564fr)` / `minmax(0, 285fr)` so the columns shrink rather than refusing to dip below their content's intrinsic width.

---

## 8. Responsive behavior — columns flex, no separate narrow mode

There is no longer a separate narrow-mode layout. The three columns flex to fit every target width: Trials stays fixed at 155 px while Simulation and Data shrink proportionally in their 564 : 285 ratio from 1044 px down to 767 px (see §7). The earlier plan switched to an alternate layout below ~900 px; that mode switch has been removed, so `<SimulationFrame>` carries no narrow-mode renderer and no `$frame-narrow-breakpoint`. Q30 is closed (see §15).

### Earlier hypothesis (closed)

The following was the working hypothesis before the flex-column model superseded it, kept for historical context.

The three-column side-by-side layout was assumed to break below ~900 px (the simulation column would be < 260 px wide, unusable), so at 676 px an alternate layout was thought necessary.

**Working hypothesis: collapsible Trials and/or Data, overlaying the Simulation**

- One or both side columns (Trials, Data) become **collapsible** at narrow widths.
- When the user opens a collapsed column, it **overlays the Simulation** rather than reflowing the layout.
- The simulation column **does not shrink and grow** as overlays open and close; it keeps its size. The overlay sits on top of the simulation column and can be dismissed.
- This means the simulation viewport stays stable for the student, which avoids re-layout artifacts mid-interaction (especially mid-drag-and-drop or mid-animation).

**Other shapes considered (not preferred)**

- Trials as a thin horizontal strip above or below simulation + data — loses the vertical-list affordance.
- Data panel tabbed/togglable with the simulation column — splits the student's attention awkwardly.
- Drop to a two-column layout with trials moved into a sticky strip — middle-ground; loses the consistent visual signature.

**Architectural seam (removed)**

The `SimulationFrame` was to support narrow mode via a `layout="narrow" | "wide"` prop driven by a CSS container query (or `window.matchMedia`) at the ~900 px breakpoint. The flex-column model removed the need for it.

---

## 9. Sim chrome (sim title bar) and AP embed

`<SimulationFrame>` renders **one** 50 px-tall header row — the **sim title bar** — at the top of the sim. Layout, left to right:

- Left cluster: `simTitle` (Lato 24 / 28 px bold) followed by `tagline` (Lato 16 / 20 px regular).
- Right cluster: the project-wide partner branding (DESE + Concord Consortium logos, shipped as SVGs inside `packages/shared` and rendered by `<SimulationFrame>` internally — the same in every Mass Sims sim) followed by the **About** button (`min-height: 44 px`, 2 px border `#555`, 6 px border-radius, info icon + "About" label).

The sim title bar is rendered **always** — both in standalone deploys and when embedded in Activity Player — and its contents are identical in either context. The only chrome that differs by context is the outer container (the 2 px / 10 px-radius border), which embedded sims suppress so AP's chrome is the sole container (see #29).

**What's NOT part of the sim:** the teal "**[Sim] Simulation**" bar that appears above the sim title bar in the demo (background `#047a99`, Lato 16 px white text) is rendered by Activity Player's wrapper chrome, not by `<SimulationFrame>`. `<SimulationFrame>` has no `projectName` prop and does not render that row. In standalone deploys (no AP wrapper), the teal bar simply doesn't appear — there's nothing the sim needs to do to suppress it, because the sim never rendered it.

**Vertical budget at 562 px height:** 50 px title bar + 512 px for the three-column body. The 17 px notch overlap of each Section's title chip eats further into the body; the panel content area below the chip is therefore ~495 px tall (minus internal padding). Tight but workable. The body's column gap is 10 px; the body's padding is 10 px on each side.

---

## 10. Scrolling within regions

With ~512 px of column height below the title bar (and ~495 px below the Section chip notch), individual region content can overflow:

- **Trials list** scrolls vertically.
- **Data panel** scrolls vertically inside the panel — important when there are multiple sub-sections (table + chart + summary).
- **Simulation** does not scroll — sim viz and its controls must fit. If a sim outgrows the simulation column height, the sim is responsible for compacting (smaller controls, tighter viz scale), not the frame.

---

## 11. Touch interaction

Touch is a first-class concern (Chromebooks, iPads):

- All interactive controls (slider thumbs, buttons, trial-card click areas, the trial-card reset button, dialog close buttons) have hit targets ≥ 44 × 44 px.
- We rely on Pointer Events rather than mouse-only events.
- `@dnd-kit` already handles touch/pointer parity.
- We avoid any hover-required UI patterns (tooltips that surface only on hover, etc.).
- A `--touch-target-min` design token in `tokens.scss` (mirrored as a CSS custom property by `global.scss`) makes this enforceable centrally.

---

## 12. Reload protection

Because runs do not persist across page reloads, the shell registers a `beforeunload` listener via `useReloadWarning()` that triggers the browser's native "Leave site?" confirmation when at least one run has been recorded. Light-touch — no custom modal, just the standard browser warning.

---

## 13. Visual style and design tokens

The first designed sim (Bananas, AP Full Width — see [the demo](https://models-resources.concord.org/demos/branch/masssims/)) has landed. The values below are what the demo specifies; they replace the earlier FOSS-palette placeholders. `packages/shared/src/styles/tokens.scss` is the single source of truth; component `.scss` files `@use` the tokens module, and a separate `global.scss` (imported once per sim) emits the runtime `:root { --foo: ... }` mirror so the custom-property block isn't duplicated across separately-compiled SCSS modules.

**No light/dark mode. No custom accessibility/color-blind themes.**

### Color palette (from the demo)

The palette is mostly grayscale plus one focus blue and the panel-surface tone. Sim-specific accent colors (e.g. Bananas' healthy/infected gray/dark-gray swatches) live in the sim, not in the shared tokens.

| Token | Value | Role |
| --- | --- | --- |
| `$color-text` | `#333` | Primary text everywhere |
| `$color-text-muted` | `#555` | Secondary text |
| `$color-surface` | `#fff` | Card / button / modal surface |
| `$color-surface-muted` | `#e8e8e8` | Section panel interior background |
| `$color-surface-hover` | `#f0f0f0` | Button / card hover |
| `$color-surface-active` | `#d0d0d0` | Button / card active |
| `$color-border` | `#555` | Section / button / card / chip border (2 px width) |
| `$color-border-subtle` | `#ccc` | Modal header rule, secondary dividers |
| `$color-divider` | `#555` | 1 px horizontal rule in `<DataSubsection>` separation |
| `$color-focus-outline` | `#005FCC` | `:focus-visible` outline color |
| `$color-trial-badge-bg` | `#e0e0e0` | Trial-card letter-badge background (idle) |
| `$color-trial-badge-bg-selected` | `#000` | Trial-card letter-badge background (selected) |

The teal `#047a99` from the demo is AP's chrome — not a sim color. Bananas' `#C2C2C2` / `#444` healthy/infected swatches are sim content — not a shared token.

### Typography

`Lato` is the primary sans for the sim. `Roboto Condensed` is used only inside trial-card content (where dense numeric content benefits from condensed glyphs). No `Roboto`, no `Barlow` in the sim itself.

| Token | Value | Role |
| --- | --- | --- |
| `$font-family-base` | `"Lato", system-ui, -apple-system, sans-serif` | Default for everything |
| `$font-family-condensed` | `"Roboto Condensed", system-ui, -apple-system, sans-serif` | Trial-card body content |
| `$font-size-xs` | 12 px | Reserved |
| `$font-size-sm` | 14 px | Reserved |
| `$font-size-base` | 16 px | Body text, instruction, tagline |
| `$font-size-lg` | 18 px | Section title chip label, trial letter badge |
| `$font-size-xl` | 24 px | Sim title (`simTitle`) |
| `$line-height-sm` | 20 px | Pairs with 16 px size |
| `$line-height-lg` | 28 px | Pairs with 24 px size |

Font weights used: 400 (regular), 700 (bold). Section title chip and sim title are bold; tagline and instruction are regular. The bullet separator in Section's chip is at 16 px regular even when the title is 18 px bold (per the demo).

### Spacing scale

Inherited from earlier drafts and confirmed compatible with the demo's gap / padding values: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. The demo body uses `gap: 10 px` between region panels and `padding: 10 px` around the body — a 10 px token (`$space-2-half`?) may be worth adding, or just keep the in-component value as a one-off because no other surface uses 10 px.

### Dimensions

| Token | Value | Role |
| --- | --- | --- |
| `$frame-height` | 562 px | Fixed across all four widths |
| `$frame-width-ap-full` | 1044 px | Activity Player Full Width |
| `$frame-width-standalone` | 1024 px | Standalone deploy |
| `$frame-width-ap-2col-hidden` | 989 px | AP 2-Column, resources hidden |
| `$frame-width-ap-2col-shown` | 767 px | AP 2-Column, instructions panel visible |
| `$frame-titlebar-height` | 50 px | The single sim title bar |
| `$column-trials-width` | 155 px | Trials column — fixed across all layouts |
| `$column-simulation-flex` | 564 (unitless) | Simulation column flex ratio (shares space with Data) |
| `$column-data-flex` | 285 (unitless) | Data column flex ratio (shares space with Simulation) |
| `$column-gap` | 10 px | Gap between the three columns |
| `$body-padding` | 10 px | Padding around the body region |
| `$section-chip-height` | 36 px | The notched title chip |
| `$section-chip-overlap` | 17 px | How much of the chip overlaps the panel top |
| `$touch-target-min` | 44 px | WCAG / iOS / Material minimum |

`$frame-projectbar-height` (40 px) is **removed** — there is no project bar in the sim. The previous `$frame-subheader-height` is renamed to `$frame-titlebar-height` and bumped from 48 to 50 px.

### Border / radius / focus

| Token | Value | Role |
| --- | --- | --- |
| `$radius-sm` | 4 px | Inner badges (trial-card letter) |
| `$radius-md` | 6 px | Buttons (About, sim-buttons, trial cards) |
| `$radius-lg` | 8 px | Section panel, Section chip, info modal |
| `$radius-frame-standalone` | 10 px | Standalone outer container (2 px border + this radius) |
| `$border-strong` | 2 px solid `$color-border` | Section / button / card / chip border |
| `$focus-outline` | 2 px solid `$color-focus-outline` | Default focus ring (2 px offset) |

The earlier `$radius-section: 15 px` is **removed** — the demo's Section radius is 8 px.

### Info modal

The About modal is structurally distinct from any other dialog the sim might surface. Its dimensions and behavior are pinned at the design layer:

- `$modal-info-width` 400 px, `$modal-info-max-height-pct` 70 %.
- `$modal-info-offset-top` 50 px (matches the title bar height), `$modal-info-offset-right` 10 px.
- Draggable via the modal header (`cursor: grab` / `:active { cursor: grabbing }`).
- Drag position does not persist; always opens at the default top-right.
- No backdrop scrim; the sim content behind the modal stays interactive.
- Close affordances: the close button (44 × 44 px), Escape, and focus return to the About button on close.

The future shared `<Dialog>` (Phase 3) used for the reload-warning confirmation and any other dialogs uses a conventional centered overlay with backdrop scrim — that's a separate component, not a variant of the info modal.

---

## 14. Resolved UI decisions

Kept here as a decision log.

12. **Simulation region layout** → Single column (sim viz + controls together).
13. **Data panel position** → Right column. May contain multiple labeled sub-sections.
14. **Trials list** → Left column, vertical and scrollable (no fixed count). Each trial-card click restores that trial's state (per FOSS/DESE). Trials are reset via the upper-right reset button on the selected card — they are not deleted (supersedes the earlier "delete affordance" inheritance from DESE; see #24). No drag, no side-by-side compare.
14a. **Per-region section titles** → Each of the three regions is wrapped in a `<Section>` with a small labeled title chip notched into the top edge. The Simulation section's chip can carry an adjacent instruction string. The canonical slot label can be overridden per-sim via a `title` prop — slot identity (component name, grid-area, Section id) stays canonical; only the visible label diverges.
15. **Run history persistence** → Not persisted across reloads, but the shell shows the browser's native unload confirmation when at least one run exists.
16. **Default color palette** → Demo-derived (see §13): mostly grayscale (`#333`, `#555`, `#fff`, `#e8e8e8`, `#f0f0f0`, `#d0d0d0`) plus `#005FCC` for focus outlines and `#e8e8e8` for the Section panel interior. FOSS's blue/orange/green/purple palette was the placeholder seed; it has been superseded. Sim-specific accent colors live in the sim, not in shared tokens.
17. **Light/dark mode** → No.
18. **Devices and viewport** → Four exact widths (1044, 1024, 989, 767) at a fixed 562 px height. Widths are driven by Activity Player's embedding modes; height is driven by working backwards from the tightest available viewport across supported devices (Chromebook is the binding constraint at 609 px available height). Supported devices: Teacher Desktop, Chromebook, iPad 10th gen (landscape), Android tablet (landscape). iPad ≤ 9th gen has a known 20 px width-overflow on the right edge of the data column, accepted as a known edge case. The three columns flex to fit every width — Trials fixed at 155 px, Simulation and Data sharing the rest in a 564 : 285 ratio (see §7); there is no separate narrow mode. Touch-friendly hit targets (≥ 44 × 44 px) throughout. Trials list and data panel scroll vertically inside their columns; the simulation column does not scroll.

19. **Sim title bar (one row, always rendered)** → `<SimulationFrame>` renders a single 50 px header row with `simTitle` + `tagline` on the left and project-wide partner branding (DESE + Concord Consortium SVGs) + the About button on the right. No project bar in the sim itself. The teal "[Sim] Simulation" bar above is Activity Player's chrome and is not modeled by `<SimulationFrame>` at all. The title bar and its contents render identically standalone and embedded; the only context-dependent chrome is the outer container, which embedded sims suppress (see #29).

20. **Partner branding scope** → Identical across every Mass Sims sim. The DESE + Concord Consortium logos ship as SVGs inside `packages/shared` and are rendered internally by `<SimulationFrame>`. Not configurable per sim, not exposed as a prop.

21. **About-panel pattern** → Draggable side panel anchored top-right (400 px wide, 70 % max height). Key properties, as implemented:
    - **Non-modal** (`role="dialog"` only; no `aria-modal`). Sim content behind the panel stays interactive — that's the whole point of a draggable panel. `aria-labelledby` still points at the panel heading so screen readers announce the dialog on open.
    - **Frame-anchored** (NOT viewport-anchored). The panel renders inline as a child of `.simulation-frame` (which is `position: relative`), so when a sim renders multiple frames or sits inside a transformed/contained ancestor, each panel stays attached to its own frame's top-right corner. `createPortal` is intentionally NOT used.
    - **No backdrop scrim.** Sim content behind it is fully visible and interactive.
    - **Drag position resets each open** — always reappears at the default top-right.
    - **Toggle behavior**: clicking the About button while the panel is open closes it (matches the demo).
    - **Keyboard dragging**: Alt+Arrow nudges the panel 10 px in that direction; Shift+Alt+Arrow uses a 40 px step. Required because a draggable affordance has to be operable from the keyboard.
    - **Drag-listener hygiene**: the pointer-drag gesture attaches `pointermove` / `pointerup` to `window` so the gesture keeps tracking when the pointer leaves the handle; a `dragCleanupRef` + unmount effect detaches them if the frame unmounts mid-drag.

    The About panel is the only dialog in the sim that uses this pattern.

22. **Other dialogs (reload warning, future)** → Conventional centered overlay with backdrop scrim, full modal semantics (`aria-modal="true"`). Implemented by the future shared `<Dialog>` component (Phase 3), distinct from the About panel.

23. **Credits** → Appear inside the About panel (no separate credits dialog).

24. **Trial-card affordances** → The trial-card chrome is common across sims and lives in the shared `<TrialCard>` component: 120 × 136 px card, 2 px border, letter badge (A through J, auto-assigned by index) in upper-left, and a 44 × 44 px reset affordance in upper-right that appears only on the selected card. Sim-specific per-trial content goes inside the card as `children`. Trials are reset, not deleted — supersedes the earlier "delete affordance" inheritance from DESE.

25. **Data sub-section component** → Sub-sections inside the Data slot use `<DataSubsection>`, not `<Section>`. Flat visual treatment (centered bold heading, no chip, 1 px horizontal-rule divider rendered automatically between consecutive `<DataSubsection>` siblings). Heading is a real `<h3>` for accessibility. Sims may render any number of `<DataSubsection>` siblings. `<DataSubsection>` is not a `<Section>` variant — the markup, ARIA structure, and visual treatment differ on purpose.

26. **Section title chip — bullet separator** → Section's CSS renders the `•` between title and instruction via `::before` on the instruction element. Consumers pass `title` and `instruction` as props; the bullet is invisible to the API.

27. **AP 2-Column "Resources" panel** → Activity Player renders its own teacher-facing resources sidebar in the 2-Column layout. The sim does not render this — the 989 / 767 px widths are simply what AP allocates to the sim after its sidebar takes its share.

28. **Columns flex below 1044.** Trials stays fixed at 155 px; Simulation and Data share the remaining space in a 564 : 285 ratio. The previous "fixed three columns at 1044, alternate layout below" model is superseded.

29. **Standalone sims render an outer container.** A 2 px solid border with a 10 px corner radius wraps the SimulationFrame when `standalone={true}` (the default). Sims derive the prop from embed detection (`standalone={!isEmbedded}`) so an AP-embedded sim suppresses the container, leaving AP's chrome as the only visual container.

---

## 15. Open UI questions

These remain unanswered. Each is a decision the designer + team need to make.

### Visual / interaction

~~**Q9. UI component library.** MUI v9 (decoupled from Emotion) vs. dropping MUI entirely vs. an alternative (Radix / Headless UI / shadcn-style).~~ **Closed.** Resolved to `react-aria-components`. See infrastructure-plan.md §11 #9 and §3 "Shared controls policy."

~~**Q19. Graphing library.** Recharts / Visx / Chart.js / D3 — different sims will likely need different chart types. Decision affects the shared library's chart primitives and per-sim dependencies.~~ **Closed.** Resolved to **hand-rolled SVG** (no charting library) — shared `<LineChart>` and `<Histogram>` in `packages/shared` are React + SCSS + SVG, matching FOSS / DESE precedent. See infrastructure-plan.md §11 #19 and §3's `<LineChart>` / `<Histogram>` entries.

**Q20. Simulation rendering layer.** Plain DOM/SVG vs Canvas 2D vs Three.js vs Pixi.js. Standardize on one, or accept per-sim choice?

**Q21. `<RunsTable>` and `<BarGraph>` in shared, or sim-specific?** Hinges on how uniform the data shapes are across the planned four sims.

~~**Q30. Narrow-mode (676 px) layout.**~~ **Closed.** The three columns flex from 767 to 1044; no alternate layout is required. See §7.

~~**Q31. Chrome suppression when embedded in Activity Player.**~~ **Resolved (#19):** the sim renders one 50 px title bar always, in standalone and embedded mode, and there is no project bar to suppress. (The outer container is the one piece of chrome that differs by context — embedded sims suppress it; see #29.)

**Q32. Sim-title typography at narrower widths.** The designed sim-title-bar at 1044 px shows `simTitle` at 24 / 28 px bold beside `tagline` at 16 / 20 px regular. Whether the tagline truncates, wraps, hides, or scales at 989 / 767 px is still being designed.

**Q33. Trial-card scrolling behavior.** Demo's Trials column is `overflow-y: auto` with `padding: 31 px 0 12 px 15 px`. Whether the scroll indicator is custom-styled, whether the chip is sticky-pinned at the top when the column scrolls, etc., is not yet specified.

**Q34. Data sub-section vertical proportions.** The demo allocates 50/50 (with a 10 px nudge) between pie chart and line graph. Whether `<DataSubsection>` defaults to equal heights, or accepts explicit ratios, or measures intrinsic content is not yet specified.

**Q35. Empty-state copy and styling.** The demo shows "No data" placeholders inside chart areas. Whether `<DataSubsection>` provides a standardized empty-state prop or sims handle it ad-hoc is not yet specified.

---

## 16. In flux / not yet decided

A running list of things the designer is iterating on. Items here may move into Resolved or Open Questions as decisions firm up.

- Sim-title typography at narrower widths (see Q32).
- Trial-card scrolling behavior — sticky chip, custom scroll indicator, etc. (see Q33).
- `<DataSubsection>` sub-section vertical proportions (see Q34).
- Empty-state copy and styling (see Q35).
- Data panel sub-section visual hierarchy when there are 3+ sub-sections (only 2 are realized in the demo).

**Closed since this section was last updated:**

- ~~Exact column widths~~ → 155 / 564 / 285 at 1044 px (Resolved #18, §13).
- ~~Section title chip styling~~ → 36 px tall, 8 px radius, 2 px border, centered notch overlay, bullet separator via Section CSS (Resolved #14a, §13).
- ~~Whether the Simulation instruction text sits inside the title chip or beside it~~ → Inside the chip, separated from the title by a `•` bullet (Resolved #14a / #26).
- ~~Whether Trials rows show a thumbnail / parameter preview, or just a label~~ → Per-trial card content: cross label (parent abbreviations) + offspring count + healthy/infected percentages. Sim-specific content via `<TrialCard>` children.
- ~~Delete affordance~~ → No delete. Trials are reset via the upper-right reset button on the selected card (Resolved #24).
- ~~Specific colors~~ → Demo palette identified; mostly grayscale + focus blue + panel-surface tone (Resolved §13).
- ~~Embedded-mode chrome suppression~~ → No suppression mode (Resolved #19, §15 Q31 closed).
- ~~Narrow-mode (676 px) collapsible behavior~~ → No separate narrow mode; columns flex from 767 to 1044 (Resolved #28, §7/§8, Q30 closed).

---

*End of UI Design Plan. This document iterates with the designer. When a question moves from §15 to §14, the corresponding decision is also reflected (briefly) in the infrastructure plan's component-contract stub at §3.*
