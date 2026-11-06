# Mystery Lumps — design

**Story:** [MAS-57](https://concord-consortium.atlassian.net/browse/MAS-57)
**Date:** 2026-10-15
**Status:** approved design, not yet planned

## What it is

Five white lumps washed up on a beach. A student runs tests on them to work out what each
one is, and writes the argument up on paper. **The sim never asks for an identification and
never grades one** — its whole job is to produce observations a student can cite as evidence.

The lumps are seashell, sea salt crust, white sea glass, palm oil and paraffin wax. Handling
a lump names the salt and sorts the rest into a hard pair and a waxy pair; past that, every
claim has to rest on a reaction.

## The science model

Fixed assignment, the same for every student, so a class can talk about "lump C" and mean
the same thing:

| Lump | A | B | C | D | E |
|---|---|---|---|---|---|
| | paraffin wax | sea salt crust | white sea glass | palm oil | seashell |

One action is **free, repeatable and non-destructive**: *look, feel, smell*. Four are
**destructive — each lump has material for exactly one**: water, vinegar, warm bath, UV lamp.

### Observations

Nothing is interpreted for the student. Captions describe what happens; they never name a
substance or a class of substance ("a steady stream of small bubbles", never "a carbonate").

| | Handle | Water | Vinegar | Warm bath | UV lamp |
|---|---|---|---|---|---|
| **Sea salt** | a crust of small cube-shaped crystals | dissolves away, water stays clear | dissolves away, no bubbles | nothing (it stays dry) | nothing |
| **Seashell** | hard and smooth, cool to the touch | nothing | **a steady stream of small bubbles** | nothing, at any temperature | nothing |
| **Sea glass** | hard and smooth, cool to the touch | nothing | nothing | nothing, at any temperature | **glows, immediately** |
| **Palm oil** | waxy and pale, gives under a fingernail | nothing | nothing | **slumps and runs by 45 °C** | **glows**; long exposure also turns it rancid |
| **Paraffin** | waxy and pale, gives under a fingernail | nothing | nothing | **softens, then melts, by 80 °C** | long exposure yellows it, chalks the surface, makes it brittle |

Refined paraffin, seashell and salt **do not fluoresce**. Only sea glass and palm oil glow,
which is what gives the lamp a job nothing else can do.

### Settings

The lamp has a dial, a dropdown matching Nor'easter's. The bath has none:

- **Warm bath** — the lump sits in a dry dish inside the bath, so only heat reaches it, and one
  run steps it through 30 °C, 45 °C and 80 °C (two simulated minutes at each), reporting every
  step, phase changes included (each wax softens before it melts). The three temperatures are
  written on the instrument and light in turn as the run goes. Palm oil melts by 45, paraffin by
  80. Salt, shell and glass never change.
- **UV lamp** — a few seconds, an hour, a day, two weeks. Fluorescence is immediate at every
  exposure. Degradation needs the long end: palm oil goes rancid from *a day*, paraffin
  yellows and chalks only at *two weeks*.

### Smell

**Smelling yields nothing until the lamp has done its work.** Fresh, all five lumps are small
and odorless; only UV-degraded palm oil smells. This is deliberate: examining is free, so if the
smell discriminated on its own it would solve the puzzle for nothing. It stays available afterwards,
on any lump, so a student can go back and find the smell late.

### Mass

Each destructive test records the lump's mass before and after, to 0.1 g. Lumps are roughly
5–7 × 3 × 2 cm and deliberately differ in size, so the starting mass doesn't rank densities
and hand out an answer for free. Only a change in mass counts as evidence.

| Lump | Density (g/cm³) | Volume (cm³) | Mass (g) |
|---|---|---|---|
| A paraffin | 0.90 | 38 | 34.2 |
| B sea salt | 2.17 | 31 | 67.3 |
| C sea glass | 2.50 | 34 | 85.0 |
| D palm oil | 0.89 | 40 | 35.6 |
| E seashell | 2.50 | 36 | 90.0 |

Dissolving takes the mass to 0. Shell in vinegar loses 0.4 g as gas; every vinegar note says the container is open, so the loss has an explanation. Paraffin after two weeks
under the lamp loses 4% (the crumbled corner). Melting and softening change nothing, because
the material is all still there.

### What the puzzle costs

Handling names the salt and leaves two look-alike pairs. One test on *one member* of a pair
cracks that pair by elimination, so a sharp student finishes on **two tests** — vinegar or
lamp for the hard pair, bath or lamp for the waxy pair. A student who wants a reaction behind
every claim spends four or five. That gap between "solved" and "evidenced" is the thing the
paper assignment can ask about; the sim takes no position on it.

## What a student does

The Simulation column is a **sample tray** across its full width and a **Test Lab** filling the
rest below it.

The tray holds the lumps that still have material, each a picture and a letter. **Clicking one
puts it on the bench** — click to select rather than drag, so the tray is reachable by keyboard
and screen reader like every other control in the repo. Drag-and-drop can be added later as a
second way in, never as the only one.

The Test Lab is a drawing of a lab bench with the chosen lump on it. A row of controls along
the bottom holds:

- **Test** — water, vinegar, warm bath, UV lamp. Choosing one brings that test's apparatus onto
  the bench: a tube of vinegar, the lamp, and so on.
- **Setting** — applies only to the lamp, greyed out otherwise so the row does not
  jump as the test changes.
- **Look, feel, smell** — one button reporting the feel and the smell together. Available
  whenever a lump is on the bench, before its test and after but not while it runs (that would
  give the result away early), and never consuming it. What it reports changes as the lump does: palm
  oil is waxy and pale beforehand and a greasy pool after the bath, dissolved salt cannot be
  picked up at all. Both the before and the after observation are kept, because the pair is the
  argument a student writes up.
- **Run** and **Reset Trial**.

Running a test spends the lump. **It then leaves the tray**, because there is no material left
to test — but it **stays on the bench until the student picks a different lump**. That window is
the only time it can still be examined, and it is how the rancid smell is found: put palm oil
under the lamp, then examine it before moving on. Clear the bench first and the smell is
gone for that trial. Everything already observed stays in the Data column regardless.

**New** starts a fresh trial: five new lumps of the same five substances, every budget restored,
and the previous trial's card stays on screen. **Reset Trial** clears the current trial's results
in place — cheaper than a new trial but it erases the record of what was tried, which is why New
is the better habit.

Animations run about four seconds regardless of the time they represent. The compression is
stated in the caption rather than hidden, and that caption doubles as the accessible description.

## Layout

Shared three-region frame, built to Nor'easter's shipped look — pale blue surface, white panels,
blue borders, navy text, pill chips. (`docs/ui-design-plan.md` describes grey panels with notched
chips; it is stale, and this sim does not follow it.)

- **Trials** — one tall card per trial, accumulating a row per lump: lump letter, the test it was
  given, and its setting. `New` at the foot; reset on the selected card.
- **Simulation** — the sample tray across the full width at the top, the Test Lab below it with
  its bench and its control row.
- **Data** — the record, and the only place results persist once a lump has left the bench. Each
  lump that has been observed or tested at all gets a picture of itself alongside its notes in
  full prose. Since the sim asks for no identification, this panel is the deliverable.

## Under the hood

Scaffolded with `yarn new-sim mystery-lumps`; shared frame, controls and charts throughout, per
`docs/adding-a-new-sim.md`.

```
src/model/
  substances.ts   the five substances and the fixed lump assignment
  tests.ts        the six actions, which consume material, their settings
  observe.ts      observe(substance, test, setting) -> { caption, visual }
src/components/
  lump-row.tsx        the five lumps; click to put on the bench; holds end states
  test-stage.tsx      the apparatus a lump animates into, in place
  test-settings.tsx   the Lump / Test / Setting grid and Run
  trial-card-body.tsx what fills a shared <TrialCard>
  evidence-panel.tsx  the Data region
```

`observe()` is a pure function with no randomness — every fact in the table above lives there
and nowhere else, which is what the unit tests point at. State is the trial list plus the
selection; animation progress is never persisted.

### Saved state

```ts
interface Touches { before: boolean; after: boolean }
interface LumpRecord {
  examined: Touches;
  result: { test: TestId; setting: SettingId | null } | null;
}
interface Trial { id: string; lumps: Record<LumpId, LumpRecord> }
interface SavedState { trials: Trial[]; selectedTrialId: string }
```

Captions are derived from `observe()` on render rather than stored, so a wording fix reaches
work a student saved earlier.

### Logging

`lump_examined`, `test_run` (params: lump, test, setting), `trial_started`,
`trial_reset`. All snake_case, within GA4's limits.

## Testing

- **`observe()`** — every substance against every test and every setting, asserted against the
  table above. The bath and lamp thresholds get their own cases on both sides of each boundary
  (the bath's full 30/45/80 sequence for each wax, palm oil rancid at an hour and a day).
- **The one-shot rule** — a lump with a result is absent from the Lump dropdown; `New` restores
  every budget; `Reset Trial` restores the current trial's.
- **Free action** — examining never consumes a lump, and finds no smell until the lamp has
  degraded the palm oil.
- **Saved state** — a round trip through `SavedState` reproduces the trials and the selection.

## Deliberately out of scope

Identification UI and any notion of a right answer. Scoring. Varying the lump assignment per
student — rejected for fairness. A sixth substance. Sea glass color variants, and the
fluorescence of anything but sea glass and palm oil, both of which MAS-57 may revisit later.
