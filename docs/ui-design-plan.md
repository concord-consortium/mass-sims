# Mass Sims — UI Design Plan

**Status:** v0.x — in active design iteration
**Date:** May 2026
**Companion to:** Infrastructure Plan (`infrastructure-plan.md`)
**Audience:** UI designer, frontend developers building region components, anyone making visual / layout / interaction decisions

This document covers the visual design, layout, dimensions, regions, and per-region behavior for Mass Sims. It is **the working document for UI design** and is expected to iterate as the designer and team refine the look and feel. Things in it are subject to change without breaking the infrastructure plan, which remains the source of truth for tooling, file structure, dependencies, build, CI/CD, hooks API, and deployment.

The two documents are connected by one fixed contract: the `<SimulationFrame>` compound-component API and the set of hooks exported from `packages/shared`. That contract is defined briefly in the infrastructure plan's §3 stub. Everything else about how the regions look, behave, and respond to viewport changes lives here.

---

## 1. Layout philosophy: three regions

The central UI organizing principle is a three-region split:

- **Trials** — a vertically scrollable list of recorded simulation runs/trials.
- **Stage** — the simulation visualization plus its own controls.
- **Data** — the numeric / graphical record of what's happened, organized into one or more labeled sub-sections.

This is the biggest visual departure from both reference repos (FOSS and DESE). Neither has a clean three-column layout; we build it explicitly in `packages/shared/src/components/simulation-frame/`.

Each region is wrapped in a `<Section>` component — a rounded container with a small labeled title chip notched into its top edge. The chip is the shared visual signature across all three regions.

---

## 2. Proposed layout (CSS Grid)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Project bar:  <project name>                                        │   ~ 48px
├──────────────────────────────────────────────────────────────────────┤
│  Sim title  ·  tagline / instruction              [logos]  (i)       │   ~ 56px
├────────────┬────────────────────────────────────┬────────────────────┤
│ [Trials]   │ [Simulation]  <instruction>        │ [Data]             │
│            │ ┌────────────────────────────────┐ │                    │
│ • Trial 1  │ │                                │ │ [Sub-section A]    │
│ • Trial 2  │ │                                │ │                    │
│ • Trial 3  │ │   Simulation visualization     │ │                    │
│ • …        │ │                                │ │                    │
│            │ │                                │ │ [Sub-section B]    │
│ (scrolls)  │ └────────────────────────────────┘ │                    │
│            │ Controls (sim-specific)            │                    │
└────────────┴────────────────────────────────────┴────────────────────┘
```

Three columns side-by-side, each capped with a labeled title chip. The simulation column may carry secondary instruction text next to its title chip (e.g., "Select two parents to begin").

### Grid template (current draft)

```css
.simulation-frame {
  display: grid;
  grid-template-columns: minmax(160px, 200px) minmax(0, 1fr) minmax(260px, 320px);
  grid-template-rows: auto auto 1fr;
  grid-template-areas:
    "projectbar projectbar projectbar"
    "subheader  subheader  subheader"
    "trials     stage      data";
  height: 562px; /* fixed; see "Device targets" below */
}
```

Column maxes are tightened from earlier drafts so the layout still has a comfortable stage column at the tightest "wide" mode (989 px). Final per-pixel tuning is the designer's call.

---

## 3. Section component

Each region renders inside a `<Section>` wrapper — a rounded container with the labeled title chip notched into its top edge. The chip is a real DOM element (not pure decoration) so that screen readers announce the region's title and `aria-labelledby` can point to it.

```tsx
<Section title="Trials" id="trials">
  ...vertical list of trial rows...
</Section>
```

Sims don't reinvent this. Sub-sections inside the Data panel also use `<Section>`.

---

## 4. `<SimulationFrame>` usage

Each region is a named slot:

```tsx
<SimulationFrame
  projectName="Mass Sims"
  simTitle="Bananas"
  tagline="Some tag with enough text to describe the sim"
  info={<BananasInfo />}
>
  <SimulationFrame.Trials>
    {trials.map(t => (
      <TrialRow key={t.id} trial={t} onSelect={...} onDelete={...} />
    ))}
  </SimulationFrame.Trials>

  <SimulationFrame.Stage instruction="Select two parents to begin">
    <SimulationView />
    <SimulationControls />
  </SimulationFrame.Stage>

  <SimulationFrame.Data>
    <Section title="Offspring Phenotypes: All Generations">
      <PhenotypeTable />
    </Section>
    <Section title="Fungus Resistance over Generations">
      <ResistanceGraph />
    </Section>
  </SimulationFrame.Data>
</SimulationFrame>
```

The compound-component pattern (named slots) is simple and type-safe. Sims that need to add a second sub-section in the data panel or a different list affordance in trials just compose `<Section>`s inside the appropriate slot.

---

## 5. Region responsibilities

- **Trials list (left column, vertical):** A vertically stacked, scrollable list of recorded trials/runs. No fixed maximum — the column scrolls when the list overflows. Clicking a trial restores the simulation to that trial's state (same UX as FOSS and DESE). Each trial row has a delete affordance (matches DESE). No drag-to-reorder, no side-by-side comparison view — intentionally minimal.
- **Stage region (center column, single column):** The simulation visualization (canvas, SVG, Three.js scene, plain DOM, whatever the sim needs) plus that sim's controls (play/pause, sliders, switches, selects) — both stacked vertically. Stage is "the world plus the verbs." Controls live with the viz, not as a separate fourth region. The Section title chip can carry secondary instruction text ("Select two parents to begin") rendered next to the chip itself.
- **Data panel (right column):** The numeric/graphical record. May contain multiple labeled sub-sections (e.g., a phenotype table on top and a resistance-over-time chart below), each wrapped in its own `<Section>`. Pinned to the right at desktop widths.

---

## 6. Dimensions and device targets

The UI designer has specified four exact widths and one fixed height that the layout must support, driven primarily by the Activity Player's embedding modes:

| Mode | Width | Height |
| --- | ---: | ---: |
| Activity Player — Full Width layout | **1044 px** | 562 px |
| Standalone | **1024 px** | 562 px |
| Activity Player — 2-Column layout, left column hidden | **989 px** | 562 px |
| Activity Player — 2-Column layout, left column displayed | **676 px** | 562 px |

The height (**562 px**) is fixed across all four modes — it's the height Activity Player gives the iframe. Three of the four widths comfortably accommodate the three-column layout. The narrow 676 px case does not and needs a different layout (see §8).

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

## 7. Wide mode — widths 989, 1024, 1044 px

All three columns side by side, as drawn in the layout diagram. The grid template above produces:

| Width | Trials col | Stage col | Data col |
| ---: | ---: | ---: | ---: |
| 1044 px | 200 | 524 | 320 |
| 1024 px | 200 | 504 | 320 |
| 989 px (tightest wide) | 200 | 469 | 320 |

469 px of stage at the tightest wide mode is workable for most sim visualizations; final designer tuning may push the trials max down to 180 to give stage more room, but that's a per-pixel adjustment, not an architectural change.

---

## 8. Narrow mode — width 676 px

The three-column side-by-side layout breaks below ~900 px (stage would be < 260 px wide, unusable). At 676 px we need an alternate layout.

### Working hypothesis: collapsible Trials and/or Data, overlaying the stage

Current thinking — subject to designer iteration:

- One or both side columns (Trials, Data) become **collapsible** at narrow widths.
- When the user opens a collapsed column, it **overlays the stage** rather than reflowing the layout.
- The stage column **does not shrink and grow** as overlays open and close; it keeps its size. The overlay sits on top of the stage and can be dismissed.
- This means the simulation viewport stays stable for the student, which avoids re-layout artifacts mid-interaction (especially mid-drag-and-drop or mid-animation).

This is not yet locked in — there's still some uncertainty about whether the stage really won't need to resize when the overlays close, or whether some sims might prefer a push-instead-of-overlay behavior. See §11 open questions.

### Other shapes considered (not currently preferred)

- Trials as a thin horizontal strip above or below stage + data — loses the vertical-list affordance.
- Data panel tabbed/togglable with stage — splits the student's attention awkwardly.
- Drop to a two-column layout with trials moved into a sticky strip — middle-ground; loses the consistent visual signature with wide mode.

### Architectural seam

The `SimulationFrame` component supports the narrow mode via a `layout="narrow" | "wide"` prop driven by a CSS container query (or `window.matchMedia`) at the ~900 px breakpoint. The narrow-mode renderer is built once in shared and inherited by every sim.

---

## 9. Sim chrome (project bar + sim sub-header) and AP embed

562 px is tight. Account for the layout chrome inside the sim itself:

- Project bar: ~40 px
- Sim sub-header: ~48 px
- Total chrome: ~88 px → leaves ~474 px for the three columns.

When the sim is embedded in Activity Player, the project bar and sim sub-header may be redundant — AP provides its own chrome above the iframe. Suppressing both reclaims ~88 px and gives the columns the full 562 px. **Whether to suppress them in embedded mode is a design call — see Open Questions.** Architecturally, the frame already knows whether the sim is embedded (via `useIframePhone`), so it can choose its own chrome accordingly.

---

## 10. Scrolling within regions

With ~474 px of column height (or up to 562 px embedded), individual region content can overflow:

- **Trials list** scrolls vertically.
- **Data panel** scrolls vertically inside the panel — important when there are multiple sub-sections (table + chart + summary).
- **Stage** does not scroll — sim viz and its controls must fit. If a sim outgrows the stage height, the sim is responsible for compacting (smaller controls, tighter viz scale), not the frame.

---

## 11. Touch interaction

Touch is a first-class concern (Chromebooks, iPads):

- All interactive controls (slider thumbs, buttons, trial-row click areas, the delete affordance, dialog close buttons) have hit targets ≥ 44 × 44 px.
- We rely on Pointer Events rather than mouse-only events.
- `@dnd-kit` already handles touch/pointer parity.
- We avoid any hover-required UI patterns (tooltips that surface only on hover, etc.).
- A `--touch-target-min` design token in `tokens.scss` (mirrored as a CSS custom property by `global.scss`) makes this enforceable centrally.

---

## 12. Reload protection

Because runs do not persist across page reloads, the shell registers a `beforeunload` listener via `useReloadWarning()` that triggers the browser's native "Leave site?" confirmation when at least one run has been recorded. Light-touch — no custom modal, just the standard browser warning.

---

## 13. Visual style and design tokens

Current state:

- Color palette: inherit FOSS's blue/orange/green/purple as the starting point. Variables in `packages/shared/src/styles/tokens.scss` so the palette can be swapped centrally when design specs arrive. Component `.scss` files `@use` the tokens module; a separate `global.scss` (imported once per sim) emits the runtime `:root { --foo: ... }` mirror so the custom-property block isn't duplicated across separately-compiled SCSS modules.
- No light/dark mode.
- No custom accessibility/color-blind themes (covered as an exclusion in the infrastructure plan).
- A single info modal per sim covers general sim info + licensing/author credit. Minimal credits branding otherwise.

Design tokens to expose in `tokens.scss`:
- Color ramp (primary, secondary, accents, neutrals)
- Spacing scale (4/8/12/16/24/32/48/64)
- Typography scale
- Section title-chip dimensions and styling
- `--touch-target-min`
- Region paddings and corner radii

The designer will iterate on the specific values; the structure is what's locked in.

---

## 14. Resolved UI decisions

Kept here as a decision log.

12. **Stage region layout** → Single column (sim viz + controls together).
13. **Data panel position** → Right column. May contain multiple labeled sub-sections.
14. **Trials list** → Left column, vertical and scrollable (no fixed count). Each row click restores that trial's state (per FOSS/DESE); each row is deletable (per DESE). No drag, no side-by-side compare.
14a. **Per-region section titles** → Each of the three regions is wrapped in a `<Section>` with a small labeled title chip notched into the top edge. The Stage section's chip can carry an adjacent instruction string.
15. **Run history persistence** → Not persisted across reloads, but the shell shows the browser's native unload confirmation when at least one run exists.
16. **Default color palette** → Inherit FOSS's blue/orange/green/purple, structured so the palette can be swapped centrally when design specs arrive.
17. **Light/dark mode** → No.
18. **Devices and viewport** → Four exact widths (1044, 1024, 989, 676) at a fixed 562 px height. Widths are driven by Activity Player's embedding modes; height is driven by working backwards from the tightest available viewport across supported devices (Chromebook is the binding constraint at 609 px available height). Supported devices: Teacher Desktop, Chromebook, iPad 10th gen (landscape), Android tablet (landscape). iPad ≤ 9th gen has a known 20 px width-overflow on the right edge of the data column, accepted as a known edge case. Wide mode (≥ 989 px) renders three columns side by side; narrow mode (676 px) uses an alternate layout (working hypothesis: collapsible/overlay — see §8). Touch-friendly hit targets (≥ 44 × 44 px) throughout. Trials list and data panel scroll vertically inside their columns; stage does not scroll.

---

## 15. Open UI questions

These remain unanswered. Each is a decision the designer + team need to make.

### Visual / interaction

**Q9. UI component library.** MUI v9 (decoupled from Emotion) vs. dropping MUI entirely vs. an alternative (Radix / Headless UI / shadcn-style). Depends on how much of MUI we actually need beyond Button, Slider, Dialog. Lower MUI usage → dropping it shrinks bundle and API surface.

**Q19. Graphing library.** Recharts / Visx / Chart.js / D3 — different sims will likely need different chart types. Decision affects the shared library's chart primitives and per-sim dependencies.

**Q20. Simulation rendering layer.** Plain DOM/SVG vs Canvas 2D vs Three.js vs Pixi.js. Standardize on one, or accept per-sim choice?

**Q21. `<RunsTable>` and `<BarGraph>` in shared, or sim-specific?** Hinges on how uniform the data shapes are across the planned four sims.

**Q30. Narrow-mode (676 px) collapsible behavior.** Current working hypothesis is collapsible Trials/Data overlaying the stage, without the stage resizing as overlays open and close. To confirm:
- Does the stage really not need to resize when overlays close, in all cases?
- Which side(s) get collapsible behavior — Trials only? Data only? Both?
- What triggers the collapse — a button, a swipe, automatic at narrow widths?
- When collapsed, is there still a thin "tab" affordance visible on the stage edge, or is the collapsed region fully hidden behind a hamburger-style menu?

**Q31. Chrome suppression when embedded in Activity Player.** Suppressing the sim's own project bar and sim sub-header when embedded reclaims ~88 px of vertical space — meaningful given the 562 px height ceiling. Suppress fully, keep a compact-chrome variant, or always show both?

---

## 16. In flux / not yet decided

A running list of things the designer is iterating on. Items here may move into Resolved or Open Questions as decisions firm up.

- Exact column widths (current draft: trials 160-200, data 260-320; designer may tune).
- Section title chip styling (color, border radius, padding, typography).
- Whether the Stage instruction text sits inside the title chip or beside it.
- Whether Trials rows show a thumbnail / parameter preview, or just a label.
- Run-state restoration UI — what visual feedback when a user clicks a past trial?
- Delete affordance — inline icon? swipe-to-delete? hover-revealed?
- Data panel sub-section visual hierarchy when there are 3+ sub-sections.
- Specific colors once design specs arrive (currently inheriting FOSS palette as placeholder).
- The narrow-mode (676 px) collapsible behavior (see Q30).
- Embedded-mode chrome suppression (see Q31).

---

*End of UI Design Plan. This document iterates with the designer. When a question moves from §15 to §14, the corresponding decision is also reflected (briefly) in the infrastructure plan's component-contract stub at §3.*
